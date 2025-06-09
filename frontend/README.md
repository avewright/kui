# PDF Viewer Frontend

This is a React-based frontend for the PDF Viewer application.

## Features

- Drag and drop PDF upload
- View PDF documents page by page
- Responsive design

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm start
   ```

The app will start at http://localhost:3000 and will proxy API requests to the backend at http://localhost:8000.

## Building for Production

```
npm run build
```

This will create a production-ready build in the `build` folder that can be served by any static web server.

## Dependencies

- React
- React PDF (for viewing PDFs)
- React Dropzone (for drag and drop functionality)
- Axios (for API requests)
