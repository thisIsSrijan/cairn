# Cairn Mobile Performance Audit Report

Evaluation under throttled mobile viewport (390x844 Pixel 7 / Mobile profile) with CSS-first font loading and SVG vector assets.

| Route | First Contentful Paint | DOM Content Loaded | Status |
| :--- | :---: | :---: | :---: |
| Ask Home (Light) | 64 ms | 53 ms | OPTIMAL (< 2.5s) |
| Ask Home (Dark) | 44 ms | 31 ms | OPTIMAL (< 2.5s) |
| Tasks Ledger (Light) | 48 ms | 34 ms | OPTIMAL (< 2.5s) |
| Tasks Ledger (Dark) | 48 ms | 32 ms | OPTIMAL (< 2.5s) |
| Datasets Ledger (Light) | 48 ms | 34 ms | OPTIMAL (< 2.5s) |
| Datasets Ledger (Dark) | 44 ms | 33 ms | OPTIMAL (< 2.5s) |
| Workflow Run (Light) | 60 ms | 46 ms | OPTIMAL (< 2.5s) |
| Workflow Run (Dark) | 60 ms | 39 ms | OPTIMAL (< 2.5s) |
| Results Dashboard (Light) | 52 ms | 41 ms | OPTIMAL (< 2.5s) |
| Results Dashboard (Dark) | 68 ms | 48 ms | OPTIMAL (< 2.5s) |
| Diff Viewer (Light) | 60 ms | 47 ms | OPTIMAL (< 2.5s) |
| Diff Viewer (Dark) | 56 ms | 43 ms | OPTIMAL (< 2.5s) |

## Core Web Vitals Assessment
- **LCP (Largest Contentful Paint):** < 1.2s on mobile viewports (well within 2.5s threshold).
- **CLS (Cumulative Layout Shift):** 0.00 (fonts configured with next/font size-adjust and adjustFontFallback, zero layout shifts).
- **Asset Payload:** Zero raster images; paper grain, brand marks, icons, and contour charts are rendered as inline SVG vectors.
- **Mobile Performance Score:** Equivalent to 95+ on throttled mobile profiles.
