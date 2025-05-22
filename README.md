# Rice Cooking Duty Checker

A web application to manage and track rice cooking duties among family members. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- Register and manage family members
- Track current duty assignments
- View duty history
- Manage absences
- Real-time synchronization across devices using Firebase
- Mobile-friendly interface

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- Firebase account

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd rice-cooking_duty_checker
```

2. Install dependencies:
```bash
npm install
```

3. Create a Firebase project and add your configuration:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Add a web application
   - Copy the configuration
   - Create a `.env.local` file with the following variables:
     ```
     NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
     NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
     NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
     ```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter the names of family members on the initial setup screen
2. The application will automatically assign duties
3. Use the interface to:
   - Switch duties
   - Mark absences
   - View duty history
   - Update member information

## Deployment

The application can be deployed to Vercel:

1. Push your code to a GitHub repository
2. Connect your repository to Vercel
3. Add your Firebase environment variables in the Vercel project settings
4. Deploy

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License. 