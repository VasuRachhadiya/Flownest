# Deployment Guide: GitHub + Vercel + ASP.NET Core + SQL Server

Flownest keeps the **frontend** and **backend** cleanly separated so the React app runs on **Vercel** and the ASP.NET Core Web API runs on an **ASP.NET-compatible host** connected to **Microsoft SQL Server**.

---

## 1. Push to GitHub

1. Verify no secrets are staged (`appsettings.Development.json`, `appsettings.Production.json`, and `.env` are already in `.gitignore`).
2. Initialize and push:
   ```bash
   git init
   git add .
   git commit -m "Initial Flownest SaaS platform"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/flownest.git
   git push -u origin main
   ```

---

## 2. Deploy Frontend to Vercel

1. Go to [Vercel](https://vercel.com) → **Add New Project** → import your GitHub repository.
2. Configure Project Settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add **Environment Variables** in Vercel:
   - `VITE_API_BASE_URL` = `https://your-backend-api-domain.com/api`
   - `VITE_BRAND_NAME` = `Flownest` *(optional)*
   - `VITE_BRAND_TAGLINE` = `Business Operations Workspace` *(optional)*
4. Click **Deploy**. `frontend/vercel.json` handles SPA client-side routing (`/* -> /index.html`) and security headers automatically.

---

## 3. Deploy Backend (ASP.NET Core + SQL Server)

Deploy `backend/src/Flownest.Api` to any ASP.NET Core (.NET 10) host such as **Azure App Service**, **MonsterASP.NET**, **SmarterASP.NET**, **Windows IIS**, or a container host using `backend/Dockerfile`.

### Required Production Environment Variables
Set these on your hosting provider (never commit them to GitHub):

| Variable | Description |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__DefaultConnection` | Production SQL Server connection string |
| `Jwt__SecretKey` | Strong random secret (minimum 32 characters) |
| `Jwt__Issuer` | `Flownest` (or your domain) |
| `Jwt__Audience` | `Flownest.Clients` |
| `Cors__AllowedOrigins__0` | `https://your-vercel-app.vercel.app` |
| `Database__AutoMigrate` | `true` (or run `dotnet ef database update` in CI/CD) |
| `Storage__RootPath` | Persistent writable directory outside webroot |

### Applying EF Core Migrations to Production SQL Server
```bash
dotnet ef database update \
  --project backend/src/Flownest.Infrastructure \
  --startup-project backend/src/Flownest.Api \
  --connection "Server=YOUR_SQL_HOST;Database=FlownestDb;User Id=...;Password=...;Encrypt=True;"
```
