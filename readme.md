# Stream-Watch 🕵️‍♂️🐦

## Overview

Stream-Watch is a sophisticated TypeScript-based Twitter scraping tool designed for real-time monitoring and archiving of social media interactions. Leveraging Puppeteer, SQLite, and advanced web scraping techniques, this tool provides comprehensive tracking of Twitter account activities.

## 🚀 Key Features

- **Real-Time Account Monitoring**
  - Capture tweets, replies, retweets, and media
  - Persistent data storage in SQLite
  - Robust session management

- **Advanced Data Collection**
  - Comprehensive tweet metadata extraction
  - Media download and local storage
  - Intelligent gap detection and recovery

- **Resilience & Performance**
  - Self-healing scraping mechanism
  - Rate limit and bot detection avoidance

## 🛠 Technical Architecture

### Core Components
- **Authentication Module**: Secure Twitter login
- **Scraping Engine**: Real-time content tracking
- **Database Adapter**: SQLite data persistence
- **Media Handler**: Efficient media storage

### Technical Stack
- Language: TypeScript
- Web Scraping: Puppeteer
- Database: SQLite3
- Additional Libraries:
  - Puppeteer Extra
  - Stealth Plugin

## 📋 Prerequisites

### System Requirements
- Linux Operating System
- ffmpeg
- Node.js (v16+ recommended)
- npm or yarn

### Required Dependencies
- puppeteer
- puppeteer-extra
- puppeteer-extra-plugin-stealth
- sqlite3
- typescript

## 🔧 Installation

1. Clone the Repository
```bash
git clone https://github.com/layoola/stream-Watch.git
cd stream-watch
```

2. Install Dependencies
```bash
npm install
# or
yarn install
```

3. Compile TypeScript
```bash
npm run build
```

## 🚦 Configuration

### Credentials Management
⚠️ **Security Note**: Credentials are passed at runtime, never stored in configuration files.

## 💻 Usage

### Database Initialization
```bash
npm run setup -- --account=target_username
```

### Start Streaming
```bash
npm run stream -- \
  --username=your_twitter_username \
  --password=your_twitter_password \
  --account=account_to_monitor
```
or

```
npm run stream -u <your twitter username> -p <your password> -a <account to monitor>
```



## 📊 Database Schema

### Tables
- `tweets`: Tweet metadata
- `media`: Attachment information
- `actions`: User interactions

## 🛡️ Security Considerations

- Credentials passed via CLI
- User-agent rotation
- Headless browser techniques
- No plain-text credential storage

## 🐞 Troubleshooting

### Common Issues
- Login Failures
- Rate Limiting
- Network Interruptions

## 🔍 Logging

Comprehensive logging provided in:
- Console output
- `src/logs/`


## ⚖️ Legal & Ethics

- Comply with Twitter's Terms of Service
- Respect user privacy
- Use responsibly

------------

**Disclaimer**: This tool is for research and educational purposes. Always respect platform guidelines and user privacy.