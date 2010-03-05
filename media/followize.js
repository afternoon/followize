// use console.log if available, silently drop log messages if not
var log = function(s) { return; };
if (typeof console !== "undefined") { log = function(s) { console.log(s) }; }

// twitter module - just a namespace
var twitter = {
    base: "https://twitter.com",

    oauthToken: "",
    oauthTokenSecret: "",
    oauthConsumerKey: "",

    init: function(params) {
        twitter.oauthToken = params.oauthToken || "";
        twitter.oauthConsumerKey = params.oauthConsumerKey || "";
    },

    // sign ajax request params
    sign: function(params) {
        var message = {
            action:     params.url,
            method:     "GET",
            parameters: params.data
        };

        OAuth.setTimestampAndNonce(message);

        var accessor = {
            token:          twitter.oauthToken,
            consumerKey:    twitter.oauthConsumerKey
        };
        
        OAuth.completeRequest(message, accessor);

        // update the Ajax request to add oauth_ parameters
        params.data = OAuth.getParameterMap(message.parameters);
        return params;
    },

    // request data from Twitter via JSONP and pass data to callback
    load: function(params) {
        params.url = params.url + "?callback=?";
        var signedParams = twitter.sign(params);
        return $.jsonp(signedParams);
    },

    // recursively get all following 100 at a time, fire callback for each 100
    following: function(handlePage, finished, cursor) {
        var c = cursor || -1;
        var fin = finished || function() { log("Loaded all following"); };
        var followingSuccess = function(data, textStatus) {
            log({loaded: data});
            handlePage(data.users);
            if (data.next_cursor !== 0) {
                twitter.following(handlePage, fin, data.next_cursor);
            }
            else {
                fin();
            }
        };
        var followingError = function(params, textStatus) {
            log("Error: " + textStatus);
        }
        twitter.load({
            url:        twitter.base + "/statuses/friends.json",
            data:       {cursor: c},
            success:    followingSuccess,
            error:      followingError
        });
    },

    // get tweets from everyone we're following (or the first 100 right now)
    followingTweets: function(callback) {
        twitter.following(function(data) {
            callback($.map(data, twitter.tweetFromUser));
        });
    },

    // create a simple tweet record from a user record
    tweetFromUser: function(user, i) {
        return user;
        var stat = user["status"] || {text: "", created_at: new Date(0)};
        return {
            avatar: user.profile_image_url,
            screen_name: user.screen_name,
            created_at: stat.created_at,
            "status": stat.text,
        }
    },

    // comparison function to sort and array of tweets latest first
    compareTweetTimesDesc: function(a, b) {
        var userTime = function(u) { return new Date(u["status"] && u["status"].created_at || u.created_at) };
        return userTime(b) - userTime(a);
    }
};

// maintain a cache of all following users and show a sorted listed of them
var cacheAndShow = function() {
    var cache = {};

    return function(users) {
        // add latest page of users to the cache, overwriting any old users
        // from an existing user
        for (var i = 0; i < users.length; i++) {
            cache[users[i].screen_name] = users[i];
        }

        // create an array of the latest users and sort by tweet created_at
        var sorted = [];
        for (f in cache) { sorted.push(cache[f]); }
        sorted.sort(twitter.compareTweetTimesDesc);

        // show the latest users
        show(sorted);
    }
}();

// show users in a table using mustache
var show = function() {
    var containerExpr = "#content";
    var tableExpr = "#data";
    var statusTemplate = '<div class="tweet"><span class="text">{{text}}</span> <span class="created_at">{{created_at}}</span> <span class="source">from {{{source}}}</span></div>';
    var userTemplate = '<tr id="user_{{screen_name}}" class="user user_{{screen_name}}"><td class="profile_image"><a href="http://twitter.com/{{screen_name}}" title="{{name}} &mdash; {{description}}"><img src="{{profile_image_url}}" width="14" height="14" alt=""></a></td><td class="name"><a href="http://twitter.com/{{screen_name}}" title="{{name}}&mdash; {{description}}">{{screen_name}}</a></td><td class="status">{{>status}}</td><td class="send_reply"><a href="/post/?status=@{{screen_name}}%20&amp;in_reply_to={{in_reply_to_status_id}}" title="Reply to {{screen_name}}">@</a></td><td class="send_retweet"><a href="/post/?status=RT%20%40{{screen_name}}%3A%20{{text}}&amp;in_reply_to={{in_reply_to_status_id}}" title="Retweet">&#x267a;</a></td><td class="send_dm"><a href="/post/?status=d%20{{screen_name}}%20" title="Direct message {{screen_name}}">&#x2709;</a></td></tr>';
    var tableHtml = '<table id=\"data\"><tbody></tbody></table>';

    var appendUser = function(user, node) { node.append($.mustache(userTemplate, user, {"status": statusTemplate})); };

    return function(users) {
        $(containerExpr).html(tableHtml);
        var tbody = $("tbody", tableExpr);
        $.map(users, function(user, i) { appendUser(user, tbody); });
    }
}();

function showFollowingRepeatedly() {
    log("Showing latest tweets");
    twitter.following(cacheAndShow);
    return setTimeout(showFollowingRepeatedly, 1000 * 60 * 5); // every 5 mins
}
