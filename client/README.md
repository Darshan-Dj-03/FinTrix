# Fintrix Frontend

Production-ready React dashboard for the hostel mess billing system.

## Stack

- React + Vite
- Tailwind CSS
- Axios
- React Query
- React Router
- Zustand
- React Hook Form
- Recharts
- react-hot-toast
- Vitest + Testing Library

## Environment

Create a `.env` file from `.env.example`.

```bash
VITE_API_BASE_URL=http://localhost:5000
```

## Commands

```bash
npm install
npm run dev
npm run build
npm run test
```

## Role dashboards

- `student`: bills, payment history, EBL status
- `caretaker`: bill generation, payments, dynamic charges, report submission
- `admin`: approvals, analytics, ledger, student management
- `warden` and `dean`: approval and oversight screens that share the admin workspace

## Production notes

- JWT auth is stored in local storage and attached through Axios interceptors.
- The app automatically logs out when the backend returns `401`.
- Bill PDFs are downloaded through authenticated API requests.
- `/auth/me` is used to hydrate the current role and student profile after login or refresh.
