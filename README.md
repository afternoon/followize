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

  * Twitter links open in new browser.

  * Posting.

  * Open users remembered when display updates.
      * Timelines copied to new state.
      * Timeline object refreshed if new state indicates newer tweet.
      * Use `since_id` when getting newer tweets.

  * Posting, replying, sending DMs.

  * Expand "In reply to" conversations.

  * Cache state.

  * Redesign (with refresh button, big progress meter on first load, small meter
    on periodical reload).

  * Get retweets.

  * Mentions.

  * DMs.

  * Lists and searches (subscriptions stored at Twitter and cached in globalStorage).

  * Expand short urls.

  * Show images in dialog, perhaps with thumbnail inline a la FriendFeed.
