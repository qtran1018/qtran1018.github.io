# TravelBin — Collaborative Travel Planner

A web application that makes trip planning simple and collaborative. Create an account, start a travel list for your destination, add activities, and share your unique trip link with friends or family. If they have an account, invite them by email to co-edit the itinerary with you in real time.

*Inspired by Wanderlog, Google Sheets, Pastebin, Partiful, and soon Splitwise.*

**Live:** <https://travelbin.quangntran.com/>

The idea came from tools like Wanderlog — but with a twist. Wanderlog offers many features, but I found its interface too cluttered, especially on mobile. I wanted something cleaner and more focused, so I blended collaborative planning with the simplicity of Pastebin, the visual appeal of Partiful, and the shared editing experience of Google Sheets to build an app that feels intuitive, lightweight, and easy to use.

Self-hosted on an Oracle Cloud VPS with Cloudflare in front for DNS, TLS, and caching.

---

## Key Features

- **✅ Account creation & authentication** — Register and securely log in using a custom authentication system, ensuring only authorized users can create and edit trips. Session management is handled via JSON Web Tokens (JWT).
- **📝 Trip creation and activity tracking** — Create a new trip with a custom name and destination, then add planned activities like sightseeing spots, reservations, or to-dos — structured to keep planning organized.
- **📩 Email-based collaboration** — Invite others to co-edit a trip by entering their email addresses. If the invited user has an account, they're added as a collaborator, enabling real-time updates and shared editing.
- **🔗 Shareable links for view-only access** — Each trip has a unique public link that can be shared with friends or family. Visitors can view the plan without needing an account.
- **🌐 Fully responsive design** — The UI is optimized for mobile, tablet, and desktop, staying clean and easy to navigate on any device.

---

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript, React.js
- **Backend:** Python, Django, Django REST Framework
- **Database:** SQLite (AWS PostgreSQL when previously hosted on Heroku)
- **Other:** Google OAuth 2.0 (optional auth), JSON Web Tokens (JWT), Figma (design), Jira (task management), Oracle Cloud VPS + Cloudflare
