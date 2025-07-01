# AiCareOfYou - AI-Powered Personal Transformation Coach

AiCareOfYou is a comprehensive web application designed to help users track their personal growth journey through daily reflections, habit tracking, and AI-powered insights.

## Features

### 🎯 Core Functionality
- **Daily Reflections**: Record thoughts, feelings, and experiences with mood scoring
- **Habit Tracking**: Create and monitor daily habits with streak counters
- **Progress Visualization**: Interactive charts showing mood trends over time
- **AI Sentiment Analysis**: Automatic analysis of reflection sentiment
- **Voice Recording**: Integration with ElevenLabs for voice synthesis
- **Weekly Video Recaps**: AI-generated video summaries using Tavus

### 🔐 Authentication & User Management
- Secure email/password authentication via Supabase
- User profiles with personalized goals
- Onboarding flow for new users

### 📊 Analytics & Insights
- Mood trend analysis with interactive charts
- Habit completion streaks and statistics
- Weekly progress summaries
- Achievement tracking and milestone rewards

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Lucide React** for icons
- **Date-fns** for date manipulation

### Backend
- **Supabase** for database, authentication, and edge functions
- **PostgreSQL** with Row Level Security (RLS)
- **Edge Functions** for AI integrations

### External APIs
- **ElevenLabs** for voice synthesis
- **Tavus** for AI video generation

## Setup Instructions

### 1. Clone and Install
```bash
git clone <repository-url>
cd aicareofyou
npm install
```

### 2. Supabase Setup
1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the database migrations in the Supabase SQL editor
3. Enable Row Level Security for all tables
4. Get your project URL and anon key

### 3. Environment Variables
Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# ElevenLabs API (Optional)
VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Tavus API (Optional)
VITE_TAVUS_API_KEY=your_tavus_api_key
```

### 4. External API Setup (Optional)

#### ElevenLabs Setup
1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Get your API key from the profile section
3. Add the key to your environment variables

#### Tavus Setup
1. Sign up at [tavus.io](https://tavus.io)
2. Get your API key from the dashboard
3. Add the key to your environment variables

### 5. Run the Application
```bash
npm run dev
```

## Database Schema

The application uses the following main tables:

### user_profiles
- User information and goals
- Onboarding completion status

### reflections
- Daily reflection content
- Mood scores (1-10)
- Sentiment analysis results
- Optional voice recording URLs

### habits
- User-defined habits
- Frequency settings and colors

### habit_completions
- Daily habit completion tracking
- Streak calculation data

### weekly_recaps
- AI-generated weekly summaries
- Video URLs from Tavus integration

## Architecture

### Component Structure
```
src/
├── components/
│   ├── auth/           # Authentication components
│   ├── dashboard/      # Main dashboard components
│   └── onboarding/     # User onboarding flow
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries and Supabase client
└── App.tsx            # Main application component
```

### Edge Functions
```
supabase/functions/
├── analyze-sentiment/     # Sentiment analysis for reflections
├── generate-voice/        # ElevenLabs voice synthesis
└── generate-weekly-recap/ # Weekly video recap generation
```

## Key Features Implementation

### Daily Reflections
- Rich text input with mood slider
- Real-time sentiment analysis
- Voice recording integration
- Historical reflection browsing

### Habit Tracking
- Customizable habit creation
- Visual completion indicators
- Streak calculation and display
- Milestone celebration system

### Progress Visualization
- Interactive mood trend charts
- Sentiment analysis over time
- Habit completion statistics
- Achievement tracking

### AI Integrations
- Sentiment analysis using custom algorithms
- Voice synthesis via ElevenLabs API
- Weekly video recaps via Tavus API
- Automated motivational prompts

## Security

- Row Level Security (RLS) enabled on all tables
- User data isolation through Supabase policies
- Secure API key management via environment variables
- Authenticated-only access to all user data

## Development

### Adding New Features
1. Create components in the appropriate directory
2. Add database migrations for new tables/columns
3. Update RLS policies as needed
4. Add proper TypeScript types

### Testing
- Manual testing recommended for all user flows
- Test RLS policies with different user accounts
- Verify API integrations with actual service credentials

## Deployment

The application can be deployed to any modern hosting platform:

1. **Netlify/Vercel**: For frontend deployment
2. **Supabase**: Handles backend automatically
3. **Edge Functions**: Deploy via Supabase CLI

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add appropriate tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Check the documentation
- Review the Supabase setup guide
- Ensure all environment variables are correctly configured
- Verify API credentials for external services