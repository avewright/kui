// fast_pdf_to_png.c  ── MuPDF + libpng, tuned for speed
#include <mupdf/fitz.h>
#include <png.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

/* ---------- ultrafast PNG writer (grayscale, level‑1) ---------- */
static void write_png_fast(fz_pixmap *pix, const char *fname)
{
    FILE *fp = fopen(fname, "wb");
    if (!fp) { perror("fopen"); exit(2); }

    png_structp png = png_create_write_struct(PNG_LIBPNG_VER_STRING,
                                              NULL, NULL, NULL);
    png_infop   info = png_create_info_struct(png);
    if (setjmp(png_jmpbuf(png))) { fclose(fp); exit(3); }

    png_init_io(png, fp);
    png_set_compression_level(png, 1);                 /* <- speed! */

    png_set_IHDR(png, info,
                 pix->w, pix->h, 8,
                 PNG_COLOR_TYPE_GRAY, PNG_INTERLACE_NONE,
                 PNG_COMPRESSION_TYPE_DEFAULT, PNG_FILTER_TYPE_DEFAULT);
    png_write_info(png, info);

    png_bytep *rows = malloc(sizeof(png_bytep) * pix->h);
    for (int y = 0; y < pix->h; ++y)
        rows[y] = pix->samples + (size_t)y * pix->stride;

    png_write_image(png, rows);
    png_write_end(png, NULL);
    free(rows);
    png_destroy_write_struct(&png, &info);
    fclose(fp);
}
/* ---------------------------------------------------------------- */

int main(int argc, char **argv)
{
    if (argc != 3) { fprintf(stderr,"usage: %s in.pdf out_prefix\n", argv[0]); return 1; }

    struct timespec t0, t1; clock_gettime(CLOCK_MONOTONIC, &t0);

    fz_context *ctx = fz_new_context(NULL,NULL,FZ_STORE_UNLIMITED);
    fz_register_document_handlers(ctx);
    fz_document *doc = fz_open_document(ctx, argv[1]);
    fz_page     *page = fz_load_page(ctx, doc, 0);

    fz_matrix  mtx   = fz_scale(4.0f, 4.0f);             /* 4× zoom */
    fz_rect    bboxf = fz_transform_rect(fz_bound_page(ctx, page), mtx);
    fz_irect   bbox  = fz_round_rect(bboxf);

    fz_pixmap *pix = fz_new_pixmap_with_bbox(ctx, fz_device_gray(ctx), bbox, NULL, 1);
    fz_clear_pixmap_with_value(ctx, pix, 0xFF);          /* white bg */

    fz_device *dev = fz_new_draw_device(ctx, mtx, pix);
    fz_run_page(ctx, page, dev, mtx, NULL);
    fz_close_device(ctx, dev);

    char out_name[256]; snprintf(out_name, sizeof out_name, "%s.png", argv[2]);
    write_png_fast(pix, out_name);

    clock_gettime(CLOCK_MONOTONIC, &t1);
    printf("C yielded %s in %.3f s\n", out_name,
           (t1.tv_sec - t0.tv_sec) + (t1.tv_nsec - t0.tv_nsec)/1e9);

    /* tidy‑up */
    fz_drop_device(ctx, dev);  fz_drop_pixmap(ctx, pix);
    fz_drop_page(ctx, page);   fz_drop_document(ctx, doc);
    fz_drop_context(ctx);      return 0;
}
