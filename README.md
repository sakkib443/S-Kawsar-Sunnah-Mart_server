# S Kawsar Sunnah Mart — Server

Backend API for **S Kawsar Sunnah Mart**, a variety-products online marketplace.

Built with **Express**, **TypeScript**, **MongoDB / Mongoose**, JWT auth, and Cloudinary uploads.

## Getting Started

```bash
npm install
npm run start:dev   # development (ts-node-dev, port 5001)
```

## Environment

Copy `.env.example` to `.env` and fill in your own values:

- `DATABASE_URL` — MongoDB connection string
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `EMAIL_*`, `BKASH_*`, `SSLCZ_*`, `STEADFAST_*` (optional)

> **Never commit `.env`** — it holds secrets and is gitignored.
