#!/usr/bin/env python3
"""
vLLM Deployment Script for Vision Models
Supports deploying vision-language models for document extraction
"""

import argparse
import os
import subprocess
import sys
import yaml
import json
from pathlib import Path
from typing import Dict, Any

DEFAULT_CONFIG = {
    "model": "llava-hf/llava-1.5-7b-hf",
    "port": 8000,
    "host": "0.0.0.0",
    "max_model_len": 4096,
    "gpu_memory_utilization": 0.9,
    "dtype": "auto",
    "trust_remote_code": True,
    "max_num_seqs": 32,
    "worker_use_ray": False,
    "disable_log_stats": False,
    "chat_template": None
}

SUPPORTED_MODELS = {
    "llava-1.5-7b": "llava-hf/llava-1.5-7b-hf",
    "llava-1.5-13b": "llava-hf/llava-1.5-13b-hf",
    "minicpm-v": "openbmb/MiniCPM-V-2_6",
    "qwen-vl": "Qwen/Qwen-VL-Chat",
    "llava-next": "llava-hf/llava-v1.6-mistral-7b-hf",
    "cogvlm": "THUDM/cogvlm-chat-hf",
    "instructblip": "Salesforce/instructblip-vicuna-7b"
}

def load_config(config_path: str = None) -> Dict[str, Any]:
    """Load configuration from YAML file or use defaults."""
    config = DEFAULT_CONFIG.copy()
    
    if config_path and os.path.exists(config_path):
        with open(config_path, 'r') as f:
            user_config = yaml.safe_load(f)
            config.update(user_config)
    
    return config

def validate_model(model_name: str) -> str:
    """Validate and resolve model name."""
    if model_name in SUPPORTED_MODELS:
        return SUPPORTED_MODELS[model_name]
    elif "/" in model_name:  # Assume it's a HuggingFace model path
        return model_name
    else:
        print(f"Warning: Unknown model '{model_name}'. Supported models:")
        for name, path in SUPPORTED_MODELS.items():
            print(f"  {name}: {path}")
        print("\nYou can also use any HuggingFace model path directly.")
        return model_name

def check_prerequisites():
    """Check if vLLM is installed and compatible."""
    try:
        import vllm
        print(f"✅ vLLM version: {vllm.__version__}")
        return True
    except ImportError:
        print("❌ vLLM is not installed. Please install it with:")
        print("   pip install vllm")
        return False

def create_chat_template(model_name: str) -> str:
    """Create appropriate chat template for the model."""
    if "llava" in model_name.lower():
        return """{% set loop_messages = messages %}{% for message in loop_messages %}{% set content = '<image>' + message['content'][0]['image_url']['url'] + '</image>' + message['content'][1]['text'] if message['content'] is not string else message['content'] %}{% if message['role'] == 'user' %}USER: {{ content }}{% elif message['role'] == 'assistant' %}ASSISTANT: {{ message['content'] }}{% elif message['role'] == 'system' %}{{ message['content'] }}{% endif %}{% if not loop.last %}\\n{% endif %}{% endfor %}ASSISTANT:"""
    else:
        return None

def deploy_model(config: Dict[str, Any]):
    """Deploy the model using vLLM."""
    
    # Validate model
    model_path = validate_model(config["model"])
    
    # Build vLLM command
    cmd = [
        "python", "-m", "vllm.entrypoints.openai.api_server",
        "--model", model_path,
        "--host", config["host"],
        "--port", str(config["port"]),
        "--max-model-len", str(config["max_model_len"]),
        "--gpu-memory-utilization", str(config["gpu_memory_utilization"]),
        "--dtype", config["dtype"],
        "--max-num-seqs", str(config["max_num_seqs"])
    ]
    
    # Add optional flags
    if config.get("trust_remote_code", False):
        cmd.append("--trust-remote-code")
    
    if config.get("disable_log_stats", False):
        cmd.append("--disable-log-stats")
    
    if config.get("worker_use_ray", False):
        cmd.append("--worker-use-ray")
    
    # Add chat template if specified
    if config.get("chat_template"):
        cmd.extend(["--chat-template", config["chat_template"]])
    elif create_chat_template(model_path):
        template_file = "chat_template.jinja"
        with open(template_file, 'w') as f:
            f.write(create_chat_template(model_path))
        cmd.extend(["--chat-template", template_file])
    
    print(f"🚀 Deploying model: {model_path}")
    print(f"📡 Server will be available at: http://{config['host']}:{config['port']}")
    print(f"💾 Max model length: {config['max_model_len']}")
    print(f"🎮 GPU memory utilization: {config['gpu_memory_utilization']}")
    print("\n" + "="*50)
    print("Starting vLLM server...")
    print("Command:", " ".join(cmd))
    print("="*50 + "\n")
    
    try:
        # Start the server
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\n⏹️  Server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error starting server: {e}")
        sys.exit(1)

def create_docker_compose(config: Dict[str, Any]):
    """Create a docker-compose.yml for the deployment."""
    
    model_path = validate_model(config["model"])
    
    docker_compose = {
        "version": "3.8",
        "services": {
            "vllm-server": {
                "image": "vllm/vllm-openai:latest",
                "ports": [f"{config['port']}:{config['port']}"],
                "command": [
                    "--model", model_path,
                    "--host", "0.0.0.0",
                    "--port", str(config['port']),
                    "--max-model-len", str(config['max_model_len']),
                    "--gpu-memory-utilization", str(config['gpu_memory_utilization']),
                    "--dtype", config['dtype'],
                    "--trust-remote-code"
                ],
                "deploy": {
                    "resources": {
                        "reservations": {
                            "devices": [
                                {
                                    "driver": "nvidia",
                                    "count": "all",
                                    "capabilities": ["gpu"]
                                }
                            ]
                        }
                    }
                },
                "environment": [
                    "CUDA_VISIBLE_DEVICES=0"
                ]
            }
        }
    }
    
    with open("docker-compose.yml", 'w') as f:
        yaml.dump(docker_compose, f, default_flow_style=False)
    
    print("📦 Created docker-compose.yml")
    print("To deploy with Docker:")
    print("  docker-compose up -d")

def main():
    parser = argparse.ArgumentParser(description="Deploy vLLM vision model server")
    parser.add_argument("--model", type=str, help="Model name or HuggingFace path")
    parser.add_argument("--port", type=int, default=8000, help="Server port")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Server host")
    parser.add_argument("--config", type=str, help="Configuration YAML file")
    parser.add_argument("--max-model-len", type=int, default=4096, help="Maximum model length")
    parser.add_argument("--gpu-memory-utilization", type=float, default=0.9, help="GPU memory utilization")
    parser.add_argument("--docker", action="store_true", help="Generate docker-compose.yml instead of running")
    parser.add_argument("--list-models", action="store_true", help="List supported models")
    
    args = parser.parse_args()
    
    if args.list_models:
        print("Supported models:")
        for name, path in SUPPORTED_MODELS.items():
            print(f"  {name}: {path}")
        return
    
    # Check prerequisites
    if not args.docker and not check_prerequisites():
        sys.exit(1)
    
    # Load configuration
    config = load_config(args.config)
    
    # Override with command line arguments
    if args.model:
        config["model"] = args.model
    if args.port:
        config["port"] = args.port
    if args.host:
        config["host"] = args.host
    if args.max_model_len:
        config["max_model_len"] = args.max_model_len
    if args.gpu_memory_utilization:
        config["gpu_memory_utilization"] = args.gpu_memory_utilization
    
    if args.docker:
        create_docker_compose(config)
    else:
        deploy_model(config)

if __name__ == "__main__":
    main() 