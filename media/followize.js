// use console.log if available, silently drop log messages if not
var log = function (s) { return; };
if (typeof console !== "undefined") { log = function (s) { console.log(s) }; }

// twitter module - just a namespace
var twitter = {
    base: "https://twitter.com",

    oauthToken: "",
    oauthTokenSecret: "",
    oauthConsumerKey: "",

    init: function (params) {
        twitter.oauthToken = params.oauthToken || "";
        twitter.oauthConsumerKey = params.oauthConsumerKey || "";
    },

    // sign ajax request params
    sign: function (params) {
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
    load: function (params) {
        params.dataType = "jsonp";
        var signedParams = twitter.sign(params);
        log({signedParams: signedParams});
        return $.ajax(signedParams);
    },

    // recursively get all following 100 at a time, fire callback for each 100
    following: function (handlePage, finished, cursor) {
        var c = cursor || -1;
        var fin = finished || function () { log("Loaded all following"); };
        var followingSuccess = function (data) {
            log({loaded: data});
            handlePage(data.users);
            if (data.next_cursor !== 0) {
                twitter.following(handlePage, fin, data.next_cursor);
            }
            else {
                fin();
            }
        };
        var followingError = function (xhr, textStatus, errorThrown) {
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
    followingTweets: function (callback) {
        twitter.following(function (data) {
            callback($.map(data, twitter.tweetFromUser));
        });
    },

    // create a simple tweet record from a user record
    tweetFromUser: function (user, i) {
        var stat = user["status"] || {text: "", created_at: new Date(0)};
        return {
            avatar: user.profile_image_url,
            screen_name: user.screen_name,
            created_at: stat.created_at,
            "status": stat.text,
        }
    },

    // comparison function to sort and array of tweets latest first
    compareTweetTimesDesc: function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
    }
};

// maintain a cache of all following users and show a sorted listed of them
var cacheAndShow = function () {
    var cache = {};

    return function (tweets) {
        // add latest page of tweets to the cache, overwriting any old tweets
        // from an existing user
        for (var i = 0; i < tweets.length; i++) {
            cache[tweets[i].screen_name] = tweets[i];
        }

        // create an array of the latest tweets and sort by tweet created_at
        var sorted = [];
        for (f in cache) { sorted.push(cache[f]); }
        sorted.sort(twitter.compareTweetTimesDesc);

        // show the latest tweets
        show(sorted);
    }
}();

function show(tweets) {
    var template = "<table><tbody>{{# tweets }}<tr><td><img src=\"{{ avatar }}\" width=\"14\" height=\"14\"></td><td>{{ screen_name }}</td><td>{{ status }}</td><td>{{ created_at }}</td></tr>{{/ tweets }}</tbody></table>";
    $("#content").html($.mustache(template, {tweets: tweets}));
}

function showFollowingRepeatedly() {
    log("Showing latest tweets");
    twitter.followingTweets(cacheAndShow);
    return setTimeout(showFollowingRepeatedly, 1000 * 60 * 5); // every 5 mins
}

$(document).ready(function () {
    var timer = showFollowingRepeatedly();
});
