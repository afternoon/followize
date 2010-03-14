followize2
==========

  * Clicking name opens timeline like followize1 (open users remembered when
    display updates - just store list of names in fw.state.openUsers?).

  * Posting, replying, sending DMs.

  * "In reply to" conversations.

  * Redesign (with refresh button, big progress meter on first load, small meter
    on periodical reload).

  * Read mentions and DMs.

  * Lists and searches (subscriptions stored at Twitter and cached in globalStorage).

  * Cache state in sessionStorage.

Displaying timelines
--------------------

  * Timeline loaded via JSON.

  * Stored in global state object:
  
        _state[username].timeline = [tweet, tweet, tweet]

  * Extend fw.view.appendUser:
  
        if (user.open === true) {
            appendTimeline(user, container);
        }

  * Reloading preserves timeline.

      * Timelines copied to new state.

      * Timeline object refreshed if new state indicates newer tweet.

      * Use since_id when getting newer tweets.

  * If user is someone I follow, open their timeline and scroll to the right
    part of the page.

  * Get retweets.
