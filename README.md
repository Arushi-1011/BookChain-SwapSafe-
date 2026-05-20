# 📚 BookChain — SwapSafe

> A peer-to-peer textbook exchange platform for students. Swap books directly with fellow students-no middleman, no fees.

---

## 🧠 About the Project

Textbooks are expensive. BookChain solves that by letting students list books they no longer need and swap them with others on campus for free.

Built as a full software development lifecycle project, covering requirement analysis, UI prototyping, responsive design, local data persistence, and version control.

---

## ✨ Features

- **Browse listings** — search by title/author, filter by subject and condition
- **List a book** — form with validation, condition picker, and localStorage persistence
- **My Swaps** — track incoming/outgoing/completed swaps with a 4-step status timeline
- **Accept / Decline / Complete** swap requests inline
- **Profile page** — trust score, stats (books listed, swaps done, money saved), peer reviews
- **Google Books API** — auto-fill title, author, subject and cover image by ISBN or title
- **Toast notifications** — non-blocking feedback for all user actions
- **Mobile responsive** — works on all screen sizes with a mobile-first layout
- **localStorage** — listed books persist across page refreshes

---

## 🛠 Tech Stack

| Layer           | Technology                                |
|-----------------|-------------------------------------------|
| Structure       | HTML5                                     |
| Styling         | CSS3 (custom design tokens, no framework) |
| Logic           | Vanilla JavaScript (ES6+)                 |
| Icons           | Tabler Icons                              |
| Fonts           | DM Sans + DM Serif Display (Google Fonts) |
| Data            | localStorage (client-side)                |
| API             | Google Books API (ISBN/title lookup)      |
| Version Control | Git + GitHub                              |

---

## 📁 Project Structure

```
bookchain-swapsafe/
├── index.html          # App shell + all page markup
├── css/
│   ├── reset.css       # CSS reset
│   └── style.css       # Design tokens, components, responsive styles
├── js/
│   ├── data.js         # All mock data (books, swaps, user, reviews)
│   └── app.js          # Routing, rendering, interactions, API calls
├── assets/
│   └── preview.png     # Screenshot for README
└── README.md
```

---

## 📸 Pages

| Page            | Description                                                              |
|-----------------|--------------------------------------------------------------------------|
| **Browse**      | Grid of available books with search, subject filter, and condition pills |
| **List a Book** | Form to add a book with ISBN/title auto-fill via Google Books API        |
| **My Swaps**    | Incoming, outgoing, and completed swaps with timeline and actions        |
| **Profile**     | User stats, listed books shelf, and peer reviews                         |

---

## 🔮 Roadmap

- [ ] Firebase backend — real user auth and live data
- [ ] In-app messaging between swappers
- [ ] Deploy to Netlify for a live public URL
- [ ] Campus-based filtering
- [ ] Book condition photo uploads
- [ ] Email notifications for swap requests

---

## 👩‍💻 Author

**Arushi Srivastava**
- GitHub: [@arushi-1011](https://github.com/arushi-1011)

---
