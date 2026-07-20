# Kimi Auto Paste & Retry

This is a homemade Firefox extension, built for one specific annoyance: on kimi.com, when the servers are busy, a popup shows up saying there are a lot of people talking to Kimi right now and suggesting you subscribe to a paid plan for priority access. If you just want to keep retrying until your message actually gets through, clicking through that manually every time gets old fast. This extension does that for you.

Here's the short version: you copy some text, turn the extension on, it pastes that text into Kimi's prompt field and sends it. If the queue warning shows up, it closes the warning on its own and tries sending again, repeating that until the message actually goes through (or until you turn it off).

## A heads-up before you install this

This is an automation that keeps hammering a queue system that exists specifically to manage load on the site. That probably doesn't sit well with Kimi's terms of service. I'm not saying this to talk you out of using it, just so you know that side of it exists and can use your own judgment — it's not worth leaving this running all day for no reason, and it's not a good idea to push the retry interval too low.

## What's in the folder

- manifest.json — the config file that tells Firefox what this extension is
- content.js — the script that actually runs inside the Kimi page and does the work
- popup.html and popup.js — the small window that opens when you click the extension icon, with the on/off button

## Installing it

Firefox won't let you install extensions like this one permanently without going through Mozilla's official store, so this one loads as a temporary extension. It works completely fine, it just needs to be reloaded every time you close and reopen Firefox.

1. Extract this folder somewhere on your computer, like your Desktop.
2. Open Firefox and type this into the address bar: about:debugging#/runtime/this-firefox
3. Click "Load Temporary Add-on..."
4. Select the manifest.json file inside the folder.
5. That's it — the extension shows up in the list, and its icon becomes available in the browser toolbar (if you don't see it, click the puzzle-piece icon next to the address bar and pin the extension from there).

If you want it installed permanently, without reloading it every time, your options are using Firefox Developer Edition or Firefox Nightly and disabling the signature requirement in about:config, or submitting the extension to Mozilla as "unlisted" so it gets signed.

## Using it

1. Go to kimi.com and copy (Ctrl+C) the text you want to send.
2. Click the extension icon in the toolbar.
3. Click "Ativar" (Activate).
4. Leave the tab open. The extension will paste the text, send it, and if it hits the queue warning, close the warning and try again on its own every two seconds until it gets through.
5. Once the message actually sends and the warning stops showing up, the extension stops touching the field on its own, so it doesn't risk sending the same message twice.
6. If you want to send another prompt afterward, copy the new text and turn the extension off and back on — that resets its cycle.

## If something's not working

By far the most common issue is the extension running an outdated version of the script in a tab that was already open. Any time you edit content.js or reload the extension in about:debugging, you also need to refresh (F5) the Kimi tab that was already open, otherwise it keeps running the old code and it'll look like nothing is happening.

If it still doesn't work after refreshing the tab, open the browser console on the Kimi tab (F12, Console tab) before clicking "Ativar". You should see a line like this show up:

    [Kimi Auto Paste] Ativado.

And then, every two seconds, a log line saying what the extension is finding (or not finding) on the page — whether it found the text field, the send button, and the queue popup. Those logs exist specifically to make it easier to figure out where things are getting stuck — if one of the selectors stops matching the site (Kimi could change its HTML in a future update), that's where you'll see it.

## About the selectors

The selectors currently in use (defined at the top of content.js, inside the CONFIG object) were found by inspecting kimi.com by hand:

- The prompt field is either a textarea or a div with contenteditable.
- The send button isn't a real button, it's a div with the class send-button-container, which gets the class disabled when it can't be clicked.
- The queue warning shows up as a div with the class modal-container, and the button that dismisses it without pushing you toward a subscription is the one with the class km-button-secondary (its label is "Entendi").

If Kimi updates the site and these selectors stop matching, just repeat the process of inspecting the element (right-click it, Inspect, then right-click the highlighted HTML and copy the CSS selector) and update the corresponding value in CONFIG.
