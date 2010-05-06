/*
 *  Twitter
 *
 *  Module for accessing Twitter's API via OAuth-signed JSONP requests. Only
 *  supports read access as JSONP is restricted to GET requests.
 */

// twitter module - just a namespace
var twitter = {
    BASE: "https://api.twitter.com/1",

    TIMELINE_LENGTH: 10,

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
                action: params.url,
                method: "GET",
                parameters: params.data
            },
            accessor = {
                token: twitter.oauthToken,
                consumerKey: twitter.oauthConsumerKey
            };

        OAuth.setTimestampAndNonce(message);
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
        var c = cursor || -1,
            fin = finished || function() { return; },
            followingSuccess = function(data, textStatus) {
                handlePage(data.users);
                if (data.next_cursor !== 0) {
                    twitter.following(handlePage, fin, data.next_cursor);
                }
                else {
                    fin();
                }
            },
            followingError = function(params, textStatus) {
                log("Error: " + textStatus);
            };

        twitter.load({
            url: twitter.BASE + "/statuses/friends.json",
            data: {cursor: c},
            success: followingSuccess,
            error: followingError
        });
    },

    // get timeline for a user
    timeline: function(username, handleTimeline) {
        var timelineSuccess = function(data, textStatus) {
                return handleTimeline(data);
            },
            timelineError = function(params, textStatus) {
                log("Error: " + textStatus);
            };

        twitter.load({
            url: twitter.BASE + "/statuses/user_timeline/" + username + ".json",
            data: {count: twitter.TIMELINE_LENGTH},
            success: timelineSuccess,
            error: timelineError
        });
    },

    // comparison function to sort and array of tweets latest first
    compareTweetTimesDesc: function() {
        var userTime = function(u) {
            return new Date(u["status"] && u["status"].created_at || u.created_at)
        };

        return function(a, b) {
            return userTime(b) - userTime(a);
        }
    }()
};
