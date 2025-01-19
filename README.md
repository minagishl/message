# Message

This project is a fast and secure application using TypeScript and Vite, with login and real-time chat using Supabase

## Features

- **TypeScript**: Strongly typed language for building robust applications.
- **Vite**: Fast and secure web applications.
- **Supabase**: Real-time and secure database.
- **React**: A JavaScript library for building user interfaces.

## Getting Started

### Prerequisites

- Node.js
- pnpm

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/minagishl/message.git
   cd message
   ```

2. Install dependencies:

   ```bash
    pnpm install
   ```

### Usage

1. Create an .env file in the root directory, containing the Supabase url, etc:

   ```env
   VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
   VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
   ```

2. Run the development server:

   ```bash
    pnpm dev
   ```

## Scripts

- `pnpm dev`: Run the development server.
- `pnpm lint`: Lint the code.
- `pnpm build`: Build the application for production.
- `pnpm preview`: Preview the production build.

## License

This project is licensed under the MIT License. See the [LICENSE](/LICENSE) file for details.
