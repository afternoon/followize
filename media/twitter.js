/*
 *  Twitter
 *
 *  Module for accessing Twitter's API via OAuth-signed JSONP requests. Only
 *  supports read access as JSONP is restricted to GET requests.
 */

// twitter module - just a namespace
var twitter = {
    API_BASE: "https://api.twitter.com/1",
    WEB_BASE: "http://twitter.com",

    TIMELINE_LENGTH: 10,

    oauthToken: "",
    oauthTokenSecret: "",
    oauthConsumerKey: "",
    
    init: function(oauthToken, oauthConsumerKey) {
        twitter.oauthToken = oauthToken || "";
        twitter.oauthConsumerKey = oauthConsumerKey || "";
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

    // load user data from Twitter
    user: function(screenName, handleUser) {
        var userSuccess = function(data, textStatus) {
                handleUser(data);
            };

        twitter.load({
            url: twitter.API_BASE + "/users/show/" + screenName + ".json",
            success: userSuccess,
            error: fw.util.logAjaxError
        });
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
            };

        twitter.load({
            url: twitter.API_BASE + "/statuses/friends.json",
            data: {cursor: c},
            success: followingSuccess,
            error: fw.util.logAjaxError
        });
    },

    // get timeline for a user
    userTimeline: function(screenName, handleTimeline) {
        var timelineSuccess = function(data, textStatus) {
                return handleTimeline(data);
            };

        twitter.load({
            url: twitter.API_BASE + "/statuses/user_timeline/" + screenName + ".json",
            data: {count: twitter.TIMELINE_LENGTH},
            success: timelineSuccess,
            error: fw.util.logAjaxError
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
    }(),

    tweetUrl: function(screenName, tweetId) {
        return twitter.WEB_BASE + "/" + screenName + "/status/" + tweetId;
    }
};
