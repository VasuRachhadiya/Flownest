# Flownest — Business Operations SaaS Platform

Flownest is a multi-tenant business operations platform built with **React + TypeScript + Vite + Tailwind CSS** on the frontend and **ASP.NET Core Web API (.NET 10) + Entity Framework Core + Microsoft SQL Server** on the backend.

> **Configurable Branding:** Change the platform name, tagline, and support email without rewriting code using `frontend/.env` (`VITE_BRAND_NAME`, `VITE_BRAND_TAGLINE`, `VITE_SUPPORT_EMAIL`) or `frontend/src/config/brand.ts`.

## Core Modules

- **Overview Dashboard**: Real-time revenue, outstanding receivables, expenses, net profit, project status, team workload, upcoming deadlines, alerts, and recent activity.
- **CRM & Leads Pipeline**: Full customer management with profile pages, tags, related projects/invoices, plus a 7-stage visual lead pipeline with one-click lead-to-customer conversion.
- **Projects & Tasks**: List, Grid, Board, and Timeline views for projects; Kanban board (drag-and-drop), list view, multi-assignee tasks, comments, and automatic project progress tracking.
- **Team & Multi-Tenancy**: Organization workspaces with strict tenant isolation, role-based access control (`Owner`, `Admin`, `Manager`, `Member`), and token-based invitations.
- **Invoicing, Payments & Expenses**: Server-verified invoice line items/taxes/discounts, print-friendly / PDF-exportable invoices, partial/full payment tracking, and categorized expenses with receipt attachments.
- **Time Tracking & Document Center**: Live timer (with server-side overlap protection), manual time logging, billable summaries, and secure private file storage.
- **Reports, Global Search & Notifications**: Date-filtered analytics, CSV exports, print reports, `Ctrl+K` global search, and in-app notification center.

## Architecture

```
React + TypeScript + Vite (Vercel)
        │  REST + JWT + X-Organization-Id
        ▼
ASP.NET Core Web API (.NET 10)
        │  Services & Tenant Isolation Middleware
        ▼
Entity Framework Core
        │
        ▼
Microsoft SQL Server
```

## Local Development (Visual Studio + SSMS)

### Prerequisites
- **Microsoft Visual Studio 2022 / 2026** (.NET 10 SDK)
- **Microsoft SQL Server / LocalDB** & **SQL Server Management Studio (SSMS)**
- **Node.js 20+** and **npm**

### 1. Backend Setup (Visual Studio)
1. Open `backend/Flownest.sln` in Visual Studio.
2. Verify `backend/src/Flownest.Api/appsettings.Development.json` points to your SQL Server instance (defaults to `(localdb)\MSSQLLocalDB` with database `FlownestDb`).
3. Set `Flownest.Api` as the startup project and press **F5** (or run `dotnet run --project backend/src/Flownest.Api`).
4. On first run in `Development`, EF Core migrations apply automatically and seed the **Northstar Studio (Demo)** workspace:
   - **Owner:** `owner@flownest.demo` / `Demo@12345!`
   - **Manager:** `manager@flownest.demo` / `Demo@12345!`
   - **Member:** `member@flownest.demo` / `Demo@12345!`
5. Open Swagger UI at `http://localhost:5150/swagger` and connect SSMS to `(localdb)\MSSQLLocalDB` to inspect `FlownestDb`.

### 2. Frontend Setup
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open `http://localhost:5173`. Vite automatically proxies `/api` requests to `http://localhost:5150`.

## Testing
```bash
cd backend
dotnet test Flownest.sln
```
```bash
cd frontend
npm run build
```

## Deployment
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for step-by-step instructions to push to **GitHub**, deploy the frontend to **Vercel**, and deploy the ASP.NET Core backend + SQL Server.
