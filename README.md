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

  * Get retweets.

  * Redesign (with refresh button, big progress meter on first load, small meter
    on periodical reload).

  * Mentions.

  * DMs.

  * Add `target="_blank"` to "from Client" links
      * Watch out for special value: "web"

  * Remember open user state when updating, reloading, going forward, back.
      * `/home/#afternoon+martinkl+hailpixel`

  * Lists and searches (subscriptions stored at Twitter and cached in globalStorage).

  * Cache data from Twitter in browser sessionStorage (or globalStorage?).

  * Zero-pad minutes.

  * User pop-up like Seesmic, show tweets.

  * Expand short urls.

  * Show images in dialog, perhaps with thumbnail inline a la FriendFeed.
