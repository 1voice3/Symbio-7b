================================================================
 SYMBIO 700 HVAC SIMULATOR - SETUP INSTRUCTIONS
================================================================

An educational HVAC simulator built around the "Symbio 700
Information & Troubleshooting Manual" (February 2022, unofficial).
The simulator follows the manual's onboard user interface menu
structure (pages 148-163) and the phone app menu structure
(pages 106-145), with the manual itself built in for reference.

WHAT'S IN THIS PACKAGE
----------------------
  index.html        The entire simulator app (start here)
  README.txt        This file
  manual.pdf       The Symbio 700 manual (225 pages) used by the
                    built-in manual viewer
  app.js, ui.js,    App code
  data.js           Search data + manual text index
  icon.png         Home Screen icon
  pdf.min.js,      PDF viewer library (do not rename)
  pdf.worker.min.js

QUICK START (NO UPLOAD NEEDED)
------------------------------
You can also test locally: double-click index.html and the
simulator will open in your browser. (The manual viewer works
from local files too.)

HOW TO PUT IT ON YOUR iPHONE (GITHUB PAGES)
------------------------------------------
The app is a web app. GitHub turns it into a live website that
you can add to your iPhone Home Screen so it launches full-screen
like a regular app.

1. Create a GitHub account (github.com) if you don't have one.

2. Click the "+" (top right) > "New repository".
   - Name it anything, e.g. hvac-simulator
   - Leave it Public (required for free GitHub Pages)
   - Do NOT check "Add a README"
   - Click "Create repository"

3. On the repository page, click "uploading an existing file"
   (or "+ > Upload files").

4. Drag in EVERYTHING from this zip (all 9 files — no folders, and do NOT
   upload the .zip file itself):
   - index.html
   - README.txt
   - manual.pdf
   - app.js, ui.js, data.js, icon.png, pdf.min.js, pdf.worker.min.js

5. Click "Commit changes" and wait for the upload to finish
   (manual.pdf is about 9 MB, so give it a minute).

6. Turn on GitHub Pages:
   - In your repository, click "Settings"
   - Click "Pages" (left sidebar)
   - Under "Build and deployment" > Branch, choose "main",
     folder "/ (root)", then click "Save"
   - Wait 1-3 minutes. The site URL appears at the top:
     https://YOURNAME.github.io/hvac-simulator/

7. Open that URL on your iPhone.

8. Add it to your Home Screen (this is what makes it feel like an
   app):
   - In Safari, tap the Share button (square with arrow)
   - Scroll down and tap "Add to Home Screen"
   - Name it (e.g. "HVAC Sim") and tap "Add"

   Now launch it from your Home Screen - it runs full-screen
   with its own icon.

USING THE SIMULATOR
-------------------
- Bottom tabs match the controller's Level 1 menus:
  Home, Status, Settings, Service, Alarms, Utilities.
- Every screen and menu item has a gold "p.###" chip. Tap it to
  open the manual at that exact page with the launch point
  highlighted. Tap "< Simulator" to come right back.
- The magnifying glass opens the search bar. It searches every
  menu item, manual section and all 225 pages of manual text
  (letters, numbers, any combination). Results show the menu
  path to reach that point in the simulator.
- The sliders icon (top right) opens SIMULATOR CONTROLS:
  - Set outdoor air temperature, indoor load and sim speed
    (1x to 120x so you can watch 15-minute lockouts and
    30-minute defrost timers play out)
  - FAULT INJECTION: toggle compressor proving, LPC, HPC,
    contactor and sensor faults, then watch the diagnostics
    behave exactly as the manual describes (p.34-37, p.55-58).
- Service > Diagnostics > Reset Diagnostic clears trips and
  lockouts (manual p.160).
- Service > Test runs Service Test Mode: Fan On, Cool 1-2,
  Heat 1-4, Defrost, Emergency Heat with a 60-minute timeout
  (manual p.131).

NOTES
-----
- This is an educational training tool, not affiliated with or
  endorsed by Trane. The manual it references is an unofficial
  compilation (see its own preface, page 2).
- Simulation behavior follows the manual where the manual
  defines it (compressor proving p.34, LPC cutout p.35-37,
  heat pump heating lockout p.55, demand defrost p.56-58,
  CVZT control p.85, evaporator defrost p.98, test mode p.131).
  Space-temperature physics is a simplified educational model.
- Works on iPhone (iOS Safari), iPad, Android and desktop
  browsers. No internet needed after the first load except for
  GitHub Pages itself.

TROUBLESHOOTING
---------------
- "Could not load manual.pdf" - make sure manual.pdf was
  uploaded to the repository (same folder as index.html).
- Page shows 404 - wait a few minutes for GitHub Pages to
  build, then refresh.
- Nothing loads - check that GitHub Pages is enabled
  (Settings > Pages) and pointing at the main branch.
================================================================
