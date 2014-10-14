var assert = require('assert')
  , core = require('nitrogen-core')
  , request = require('request');

describe('api_keys endpoint', function() {

    it("should return user api_keys for users", function(done) {
        request({
            headers: {
                Authorization: core.fixtures.models.accessTokens.user.toAuthHeader()
            },
            json: true,
            url: core.config.api_keys_endpoint
        }, function(err,resp,body) {
            assert.ifError(err);
            assert.equal(resp.statusCode, 200);

            assert(body.api_keys);
            assert.equal(body.api_keys.length, 1);
            assert.equal(body.api_keys[0].owner, core.fixtures.models.principals.user.id);

            done();
        });
    });

    it("can create an api key", function(done) {

        var NAME = 'test api key';
        var REDIRECT_URI = 'http://localhost:9000';

        request.post({
            headers: {
                Authorization: core.fixtures.models.accessTokens.user.toAuthHeader()
            },
            json: {
                name: NAME,
                type: 'app',
                redirect_uri: REDIRECT_URI
            },
            url: core.config.api_keys_endpoint
        }, function(err,resp,body) {
            assert(!err);
            assert.equal(resp.statusCode, 200);

            assert(body.api_key);
            assert.equal(body.api_key.name, NAME);

            assert.equal(body.api_key.redirect_uri, REDIRECT_URI);

            done();
        });
    });

});