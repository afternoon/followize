Followize
=========

Followize is a Twitter client inspired by Gmail. It's optmised to make reading
efficient and easy.

Followize is a Google App Engine application written in Python and built on
Django, but the majority of the work is done client-side using JQuery.

The back-end component creates an OAuth session with Twitter. The client then
requests data directly via JSONP.

TODO
====

  * Show current user in timeline.

  * Posting, replying, sending DMs.

  * Expand "In reply to" conversations.

  * Redesign (with refresh button, big progress meter on first load, small meter
    on periodical reload).

  * Get retweets.

  * Mentions.

  * DMs.

  * Lists and searches (subscriptions stored at Twitter and cached in globalStorage).

  * Expand short urls.

  * Show images in dialog, perhaps with thumbnail inline a la FriendFeed.

  * Cache data from Twitter in browser sessionStorage (or globalStorage?).

  * Remember open user state when updating, reloading, going forward, back.
      * `/home/#afternoon+martinkl+hailpixel`

  * Add `target="_blank"` to "from Client" links
      * Watch out for special value: "web"

  * Zero-pad minutes.
