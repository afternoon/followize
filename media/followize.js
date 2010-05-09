/* 
 *  Followize state and presentation functions
 */

var fw = fw || {};

// singleton class which encapsulates state
fw.state = {
    _users: {},
    _sorted: [],

    currentUserScreenName: "",

    init: function(currentUserScreenName) {
        fw.state.currentUserScreenName = currentUserScreenName;
    },

    // add latest page of users to the cache, overwriting any old users from an
    // existing user
    update: function(users) {
        for (var i = 0; i < users.length; i++) {
            fw.state._users["user" + users[i].screen_name] = fw.util.fixupUser(users[i]);
        }
        fw.state._sorted = fw.state.sortUsers(fw.state._users);
    },

    // return latest users sorted by tweet created_at time
    sortUsers: function(cache) {
        var sorted = [];
        for (f in cache) {
            if (f.slice(0, 4) === "user") {
                sorted.push(cache[f]);
            }
        }
        sorted.sort(twitter.compareTweetTimesDesc);
        return sorted;
    },

    // getter for sorted user list
    sorted: function() {
        return fw.state._sorted;
    },

    // get user
    user: function(screenName) {
        var k = "user" + screenName;
        return fw.state._users[k];
    },

    // open 
    openUser: function(screenName, handleTimelineReady) {
        var user = fw.state.user(screenName);
        fw.util.log("Opening user " + screenName);
        user.open = true;
        twitter.userTimeline(screenName, function(timeline) {
            user.timeline = timeline.reverse().slice(0, -1);
            fw.util.log({timeline: user});
            handleTimelineReady(user);
        });
    },

    closeUser: function(screenName) {
        var user = fw.state.user(screenName);
        user.open = false;
    }
};

fw.view = {
    // how frequently should tweets be displayed (every 5 mins)
    UPDATE_FREQ: 1000 * 60 * 5,
    SLIDE_SPEED: 20,

    // template HTML
    CONTAINER_EXPR: "#content",
    TABLE_EXPR: "#data",
    TABLE_HTML: '<table id="data" cellpadding="0" cellspacing="0"><tbody></tbody></table>',
    USER_HTML: '<tr id="user_{{screen_name}}" class="user user_{{screen_name}} {{me}} {{reply_to_me}}"><td class="profile_image"><a class="user_{{screen_name}}_anchor" href="http://twitter.com/{{screen_name}}" target="_blank" title="{{name}} &mdash; {{description}}" target="_blank"><img src="{{profile_image_url}}" width="14" height="14" alt=""></a></td><td class="name"><a class="user_{{screen_name}}_anchor" href="http://twitter.com/{{screen_name}}" target="_blank" title="{{name}} &mdash; {{description}}" target="_blank">{{screen_name}}</a></td>{{>status}}</tr>',
    TIMELINE_HTML: '<tr class="old user_{{screen_name}} old_user_{{screen_name}}"><td class="profile_image"></td><td class="name"></td>{{>status}}</tr>',
    STATUS_HTML: '<td class="status"><div class="tweet"><span class="text">{{{html}}}</span> <span class="created_at">{{created_at_rel}}</span> <span class="source">from {{{source}}}</span>{{>in_reply_to}}</div></td><td class="send_reply"><a href="http://twitter.com/?status=@{{screen_name}}%20&amp;in_reply_to={{id}}" target="_blank" title="Reply to {{screen_name}}">@</a></td><td class="send_retweet"><a href="http://twitter.com/?status=RT%20%40{{screen_name}}%3A%20{{text_escaped}}&amp;in_reply_to={{id}}" target="_blank" title="Retweet">&#x267a;</a></td><td class="send_dm"><a href="http://twitter.com/?status=d%20{{screen_name}}%20" target="_blank" title="Direct message {{screen_name}}">&#x2709;</a></td>',
    IN_REPLY_TO_HTML: ' <span class="reply">in reply to <a href="{{url}}" target="_blank" title="View {{screen_name}}\'s tweet">{{screen_name}}</a></span>',
    MESSAGE_HTML: '<tr id="{{id}}" class="old"><td class="profile_image"></td><td class="name"></td><td class="status loading">{{message}}</td><td class="send_reply"></td><td class="send_retweet"></td><td class="send_dm"></td></tr>',

    // append rendered HTML for a user to provided container node
    appendUser: function(user, container) {
        var open = user.open || false,
            timeline = user.timeline || null,
            templates = {
                "status": fw.view.STATUS_HTML,
                "in_reply_to": fw.view.IN_REPLY_TO_HTML
            };

        container.append($.mustache(fw.view.USER_HTML, user, templates));
        
        if (timeline && open) { fw.view.appendTimeline(user); }
    },

    // show users in a table using mustache
    show: function(users) {
        $(fw.view.TABLE_EXPR).remove();
        $(fw.view.CONTAINER_EXPR).html(fw.view.TABLE_HTML);
        var tbody = $("tbody", fw.view.TABLE_EXPR);
        $.map(users, function(user, i) { fw.view.appendUser(user, tbody); });
    },

    // add rows for each line in the user's timeline
    appendTimelineRow: function(user, status_, sibling) {
        var userCopy = $.extend(true, {}, user), // shallow copy
            templates = {
                "status": fw.view.STATUS_HTML,
                "in_reply_to": fw.view.IN_REPLY_TO_HTML
            };
        userCopy["status"] = status_;
        sibling.after($.mustache(fw.view.TIMELINE_HTML, fw.util.fixupUser(userCopy), templates));
    },

    // append rows for a user's expanded timeline
    appendTimeline: function(user, sibling) {
        $.map(user.timeline, function(status_) { fw.view.appendTimelineRow(user, status_, sibling); });
        fw.view.bindSendHandlers();
    },

    // handle click on screen name or profile pic
    userOpenClick: function(e) {
        var screenName = fw.util.screenNameFromAnchor(this),
            loadingId = "loading_" + screenName,
            elem = $("tr.user_" + screenName),
            handleTimelineReady = function(user) {
                var anchorClass = ".user_" + user.screen_name + "_anchor";

                // hide loader
                $("#" + loadingId).remove();

                // add timeline rows
                fw.view.appendTimeline(user, elem);

                // bind userCloseClick to anchor
                $(anchorClass).unbind("click", fw.view.userOpenClick).bind("click", fw.view.userCloseClick);
            };
        
        // show loading message
        elem.after($.mustache(fw.view.MESSAGE_HTML, {id: loadingId, message: "Loading timeline..."}));

        // call Twitter
        fw.state.openUser(screenName, handleTimelineReady);

        return false;
    },
    
    // handle close user timeline click - just remove the timeline rows
    userCloseClick: function(e) {
        var screenName = fw.util.screenNameFromAnchor(this),
            anchorClass = ".user_" + screenName + "_anchor";
        fw.util.log("Closing user " + screenName);

        // close timeline rows for user
        fw.state.closeUser(screenName);
        $(".old_user_" + screenName).remove();

        // bind userOpenClick to anchor
        $(anchorClass).unbind("click", fw.view.userCloseClick).bind("click", fw.view.userOpenClick);

        return false;
    },

    // add the current user to the cache
    cacheCurrentUser: function(currentUser) {
        fw.util.log({currentUser: currentUser});
        fw.state.update([currentUser]);
    },

    // update cache and show it in one operation
    cacheAndShow: function(users) {
        // store latest tweets
        fw.util.log("Getting latest tweets");
        fw.state.update(users);

        // show the latest users
        fw.util.log("Displaying tweets");
        fw.view.show(fw.state.sorted());

        // bind event handlers for link clicks etc
        fw.util.log("Binding event handlers");
        fw.view.bindTimelineHandlers();

        // done
        fw.util.log("Finished updating");
    },

    // update view regularly
    showFollowingRepeatedly: function() {
        twitter.user(fw.state.currentUserScreenName, fw.view.cacheCurrentUser);
        twitter.following(fw.view.cacheAndShow);
        return setTimeout(fw.view.showFollowingRepeatedly, fw.view.UPDATE_FREQ);
    },

    // post a message to the Twitter
    post: function(text, in_reply_to) {
        var statusInput = $("#status").get(0);
        $("body, html").animate({scrollTop: 0}, 100);
        $("#post_entry").slideDown(fw.view.SLIDE_SPEED, function() {
            statusInput.value = text || "";
            $("#in_reply_to")[0].value = in_reply_to || "";
            fw.util.focusNoSelection(statusInput);
        });
    },

    // update remaining char count
    updateCharsRemaining: function(e) {
        var statusNodes = $("#status"),
            val = statusNodes.val(),
            n = 140 - val.length,
            charsRemaining = $("#chars_remaining");

        if (n < 0 || n === 140) c = "red";
        else if (n < 20) c = "orange";
        else c = "green";

        charsRemaining.text(n);
        charsRemaining.css("color", c);
    },

    refresh: function(e) {
        refreshTimer = fw.view.showFollowingRepeatedly();
    },

    showOriginal: function(anchor) {
        return false;
    },

    replyOpenClick: function(e) {
        fw.view.showOriginal(this);
        return false;
    },

    // send a reply, retweet or DM
    send: function(anchor) {
        qs = fw.util.parseQs(anchor.search);
        fw.view.post(unescape(qs["status"]), qs.in_reply_to);
    },

    sendClick: function(e) {
        fw.view.send(this);
        return false;
    },

    // bind timeline row handlers
    bindSendHandlers: function(context) {
        $("td.reply a", context).click(fw.view.replyOpenClick);
        $("td.send_reply a, td.send_retweet a, td.send_dm a", context).click(fw.view.sendClick);
    },

    // bind handlers for clicks to DOM nodes created by template expansion
    bindTimelineHandlers: function() {
        $("td.profile_image a, td.name a").click(fw.view.userOpenClick);
        fw.view.bindSendHandlers();
    },

    refreshClick: function(e) {
        fw.view.refresh();
        return false;
    },

    postOpenClick: function(e) {
        fw.view.post();
        $("#post").unbind("click", fw.view.postOpenClick).bind("click", fw.view.postCloseClick);
        return false;
    },

    postCloseClick: function(e) {
        $("#post_entry").slideUp(fw.view.SLIDE_SPEED);
        $("#post").unbind("click", fw.view.postCloseClick).bind("click", fw.view.postOpenClick);
        return false;
    },

    // bind handlers for persistent UI components
    bindUIHandlers: function() {
        $("#refresh").click(fw.view.refreshClick);
        $("#post").click(fw.view.postOpenClick);
        $("#close").click(fw.view.postCloseClick);
    },

    initStatusField: function() {
        var statusNodes = $("#status");
        statusNodes.keyup(fw.view.updateCharsRemaining);
        fw.view.updateCharsRemaining();
        fw.util.focusNoSelection(statusNodes.get(0));
    },

    init: function() {
        fw.view.initStatusField();
        fw.view.bindUIHandlers();
        fw.view.refresh();
    }
};
