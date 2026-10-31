# NEON CLASH ONLINE

A browser-based, real-time 1v1 fighting game. Players create a private room, share a 5-character code, and fight from separate devices. The server owns player positions, health, hits, and round wins.

## What is included

- Responsive browser game for desktop and mobile
- Private 5-character room codes
- Real-time multiplayer using Socket.IO
- Server-side movement, attacks, collision, health, and round scoring
- Keyboard controls and touch buttons
- Best-of-three rounds and rematch
- No accounts or database required

## Run it on your computer

You need Node.js 18 or newer.

1. Extract the ZIP.
2. Open a terminal in the extracted `neon-clash-online` folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the server:

   ```bash
   npm start
   ```

5. Open **http://localhost:3000** in your browser.
6. To test locally with two players, open the address in two separate browser windows. Create a room in one and join its code in the other.

The game server and web page run together. Do not open `public/index.html` directly as a file; use the local server URL.

## Put it online for friends

The easiest option is Render (one web service for both the page and multiplayer server).

### Deploy with Render

1. Create a GitHub account if you don't already have one.
2. Create a new GitHub repository named `neon-clash-online`.
3. Upload the contents of this project folder to the repository. `package.json`, `server.js`, `render.yaml`, and `public/` must be at the repository root.
4. Sign in to Render and choose **New + → Web Service**.
5. Connect your GitHub repository.
6. Render should detect `render.yaml`. If it asks for settings, use:
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
7. Deploy. Wait for the service to finish building.
8. Open the HTTPS URL Render gives you, such as `https://your-game-name.onrender.com`.
9. Share that URL with your friend. One player creates a room and sends the 5-character code; the other joins it.

### Important hosting notes

- Use one Node web service for the game page and Socket.IO server. Hosting only the static `public` folder will not provide multiplayer.
- Free hosting providers may put inactive services to sleep. The first connection after inactivity can take a little while.
- Keep the Render service running while playing. Both players must use the same deployed URL.
- Room data is kept in server memory. Rooms disappear when the server restarts or both players leave.
- This is a starter project, not a hardened public competitive game. Add moderation, abuse protection, rate limits, and stronger anti-cheat controls before opening it to the public.

## Controls

### Keyboard
- A / D: move left / right
- W: jump
- S: block
- J: punch
- K: kick
- L: special attack

### Mobile
Use the on-screen movement, jump, block, punch, kick, and special buttons.

## Project structure

```text
neon-clash-online/
├── package.json
├── server.js
├── render.yaml
├── README.md
└── public/
    ├── index.html
    ├── style.css
    └── client.js
```

## Troubleshooting

- **Can't connect:** check that the server is running and open the URL served by Node, not the HTML file directly.
- **Room not found:** check the five-character code; codes are case-insensitive.
- **Friend cannot join:** make sure both players opened the exact same deployed website URL and the room has not been closed.
- **Phone controls:** use a current mobile browser. The controls are touch-enabled.
