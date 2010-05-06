/* 
 *  Followize state and presentation functions
 */

var fw = fw || {};

// singleton class which encapsulates state
fw.state = {
    _users: {},
    _sorted: [],

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

    user: function(username) {
        return fw.state._users["user" + username]
    },

    openUser: function(username, handleTimelineReady) {
        var user = fw.state.user(username);
        fw.util.log("Opening user " + username);
        user.open = true;
        twitter.timeline(username, function(timeline) {
            user.timeline = timeline;
            fw.util.log({userTimeline: user});
            handleTimelineReady(user);
        });
    }
};

fw.view = {
    // how frequently should tweets be displayed (every 5 mins)
    UPDATE_FREQ: 1000 * 60 * 5,

    // template HTML
    CONTAINER_EXPR: "#content",
    TABLE_EXPR: "#data",
    TABLE_HTML: '<table id="data" cellpadding="0" cellspacing="0"><tbody></tbody></table>',
    USER_HTML: '<tr id="user_{{screen_name}}" class="user user_{{screen_name}}"><td class="profile_image"><a href="http://twitter.com/{{screen_name}}" title="{{name}} &mdash; {{description}}" target="_blank"><img src="{{profile_image_url}}" width="14" height="14" alt=""></a></td><td class="name"><a href="http://twitter.com/{{screen_name}}" title="{{name}} &mdash; {{description}}" target="_blank">{{screen_name}}</a></td><td class="status">{{>status}}</td><td class="send_reply"><a href="http://twitter.com/?status=@{{screen_name}}%20&amp;in_reply_to={{in_reply_to_status_id}}" title="Reply to {{screen_name}}">@</a></td><td class="send_retweet"><a href="http://twitter.com/?status=RT%20%40{{screen_name}}%3A%20{{text}}&amp;in_reply_to={{in_reply_to_status_id}}" title="Retweet">&#x267a;</a></td><td class="send_dm"><a href="http://twitter.com/?status=d%20{{screen_name}}%20" title="Direct message {{screen_name}}">&#x2709;</a></td></tr>',
    TIMELINE_HTML: '<tr id="user_{{screen_name}}" class="user user_{{screen_name}}"><td class="profile_image"></td><td class="name"></td><td class="status">{{>status}}</td><td class="send_reply"><a href="http://twitter.com/?status=@{{screen_name}}%20&amp;in_reply_to={{in_reply_to_status_id}}" title="Reply to {{screen_name}}">@</a></td><td class="send_retweet"><a href="http://twitter.com/?status=RT%20%40{{screen_name}}%3A%20{{text}}&amp;in_reply_to={{in_reply_to_status_id}}" title="Retweet">&#x267a;</a></td><td class="send_dm"><a href="http://twitter.com/?status=d%20{{screen_name}}%20" title="Direct message {{screen_name}}">&#x2709;</a></td></tr>',
    STATUS_HTML: '<div class="tweet"><span class="text">{{{html}}}</span> <span class="created_at">{{created_at_rel}}</span> <span class="source">from {{{source}}}</span></div>',

    // add rows for each line in the user's timeline
    appendTimelineRow: function(user, status_, sibling) {
        var userCopy = $.extend(true, {}, user);
        userCopy["status"] = status_;
        fw.util.log({userRowStatus: userCopy});
        sibling.after($.mustache(fw.view.TIMELINE_HTML, fw.util.fixupUser(userCopy), {"status": fw.view.STATUS_HTML}));
    },

    // append rows for a user's expanded timeline
    appendTimeline: function(user, sibling) {
        fw.util.log({userRow: user});
        $.map(user.timeline, function(status_) { fw.view.appendTimelineRow(user, status_, sibling); });
    },

    // append rendered HTML for a user to provided container node
    appendUser: function(user, container) {
        container.append($.mustache(fw.view.USER_HTML, user, {"status": fw.view.STATUS_HTML}));
        
        var open = user.open || false,
            timeline = user.timeline || null;
        if (timeline && open) { fw.view.appendTimeline(user); }
    },

    // show users in a table using mustache
    show: function(users) {
        $(fw.view.TABLE_EXPR).remove();
        $(fw.view.CONTAINER_EXPR).html(fw.view.TABLE_HTML);
        var tbody = $("tbody", fw.view.TABLE_EXPR);
        $.map(users, function(user, i) { fw.view.appendUser(user, tbody); });
    },

    // handle click on username or profile pic
    userOpenClick: function(e) {
        // TODO show throbber below this
        var username = fw.util.usernameFromAnchor(this),
            handleTimelineReady = function(user) {
                fw.view.appendTimeline(user, $("tr.user_" + user.screen_name));
                // TODO bind userCloseClick to anchor
            };
        fw.state.openUser(username, handleTimelineReady);
        return false;
    },

    // bind handlers for clicks to DOM nodes created by template expansion
    bindEventHandlers: function() {
        $("td.profile_image a, td.name a").click(fw.view.userOpenClick);
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
        fw.view.bindEventHandlers()

        // done
        fw.util.log("Finished updating");
    },

    // update HTML regularly
    showFollowingRepeatedly: function() {
        twitter.following(fw.view.cacheAndShow);
        return setTimeout(fw.view.showFollowingRepeatedly, fw.view.UPDATE_FREQ);
    }
};
