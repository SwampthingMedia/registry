var app = require('../../server')
  , assert = require('assert')
  , core = require('nitrogen-core')
  , crypto = require('crypto')
  , request = require('request');

describe('principals endpoint', function() {

    it('should create and fetch a device principal', function(done) {
        var device = {};

        core.services.principals.createSecret(device, function(err, device) {
            if (err) return callback(err);

            request.post(core.config.principals_endpoint, {
                json: {
                    type: 'device',
                    tags: ['executes:cameraCommand', 'sends:image'],
                    api_key: core.fixtures.models.apiKeys.user.key,
                    secret: device.secret,

                    sensors: [ {
                        id: 1,
                        name: 'switch',
                        executes: 'switchCommand'
                    }, {
                        id: 2,
                        name: 'temperature',
                        sends: 'temperature'
                    }],

                    name: "createTest"
                }
            }, function(post_err, post_resp, post_body) {
                assert(!post_err);
                assert.equal(post_resp.statusCode, 200);

                // this principal will be autoclaimed to the user because it is using their claim code.
                assert(!post_body.principal.claim_code);
                assert.equal(post_body.principal.visible_to, undefined);

                assert(post_body.principal.tags.length === 2);
                assert(post_body.principal.tags.indexOf('sends:image') !== -1);

                assert.equal(post_body.principal.name, "createTest");
                assert.equal(post_body.principal.sensors.length, 2);
                assert.ok(Date.now() < Date.parse(post_body.accessToken.expires_at));

                assert.equal(post_body.principal.id, post_body.accessToken.principal);

                var principalId = post_body.principal.id;
                var token = post_body.accessToken.token;

                request({
                    url: core.config.principals_endpoint + '/' + post_body.principal.id,
                    json: true,
                    headers: {
                        Authorization: "Bearer " + post_body.accessToken.token
                    }
                }, function(get_err, get_resp, get_body) {
                    assert(!get_err);
                    assert.equal(get_resp.statusCode, 200);

                    assert.equal(get_body.principal.secret, undefined);
                    assert.equal(get_body.principal.name, "createTest");
                    assert.equal(get_body.principal.salt, undefined);
                    assert.equal(get_body.principal.visible_to, undefined);

                    assert.notEqual(get_body.principal.last_connection, undefined);
                    assert.notEqual(get_body.principal.last_ip, undefined);
                    done();
                });
            });
        });
    });

    it('should be able to remove principal', function(done) {
        request.post(core.config.principals_endpoint, {
            json: {
                type: 'user',
                email: 'deluser@server.org',
                password: 'sEcReT55'
            }
        }, function(err, resp, body) {
            assert(!err);
            assert.equal(resp.statusCode, 200);

            request.del({ url: core.config.principals_endpoint + "/" + body.principal.id,
                headers: { Authorization: "Bearer " + body.accessToken.token } }, function(err, resp, body) {
                assert(!err);
                assert.equal(resp.statusCode, 200);

                done();
            });
        });
    });

    it('should reject requests for a principal without access token', function(done) {
        request({
            url: core.config.principals_endpoint + '/' + core.fixtures.models.principals.device.id,
            json: true
        }, function(err, get_resp, get_body) {
            assert(!err);
            assert.equal(get_resp.statusCode, 401);
            done();
        });
    });

    it('should fetch all principals', function(done) {
        request.get({
            url: core.config.principals_endpoint,
            headers: {
                Authorization: core.fixtures.models.accessTokens.device.toAuthHeader()
            },
            json: true
        }, function(err, resp, body) {
            assert(!err);

            assert.equal(resp.statusCode, 200);
            assert.equal(body.principals.length > 0, true);
            assert.notEqual(resp.headers['x-n2-set-access-token'], undefined);

            done();
        });
    });

    it('should fetch only user principals', function(done) {
        request.get({
            url: core.config.principals_endpoint,
            qs: {
                q: JSON.stringify({ type: 'user' })
            },
            headers: {
                Authorization: core.fixtures.models.accessTokens.user.toAuthHeader()
            },
            json: true
        }, function(err, resp, body) {
            assert(!err);
            assert.equal(resp.statusCode, 200);
            assert.equal(body.principals.length > 0, true);

            body.principals.forEach(function(principal) {
                assert.equal(principal.type, 'user');
            });

            done();
        });
    });

    it ('should reject requests for index without access token', function(done) {
        request.get({ url: core.config.principals_endpoint }, function(err, resp, body) {
            assert.equal(resp.statusCode, 401);
            done();
        });
    });

/*
    it('should login device principal', function (done) {
        var device = core.fixtures.models.principals.device;

        request.get({
            url: core.config.headwaiter_uri + "?principal_id=" + device.id,
            json: true
        }, function(err, resp, headwaiterBody) {
            assert(!err);
            assert(headwaiterBody.nonce);

            var signer = crypto.createSign("RSA-SHA256");
            signer.update(headwaiterBody.nonce);
            var privateKeyBuf = new Buffer(device.private_key, 'base64');

            var signature = signer.sign(privateKeyBuf, "base64");

            request.post(core.config.principals_endpoint + '/publickey/auth', {
                headers: {
                    nonce: headwaiterBody.nonce,
                    signature: signature
                },
                json: true
            }, function(err, resp, body) {
                assert(!err);

                assert.equal(resp.statusCode, 200);
                assert.notEqual(body.accessToken.token, undefined);

                assert(new Date() - Date.parse(body.principal.last_connection) < 61 * 1000);
                assert.notEqual(body.principal.last_ip, undefined);
                done();
            });
        });
    });
*/
    it('should login user principal at legacy endpoint', function(done) {
        request.post(core.config.principals_endpoint + '/auth', {
            json: {
                type: 'user',
                email: 'user@server.org',
                password: 'sEcReT44'
            }
        }, function(err, resp, body) {
            assert(!err);

            assert.equal(resp.statusCode, 200);
            assert.notEqual(body.accessToken.token, undefined);

            assert(new Date() - Date.parse(body.principal.last_connection) < 61 * 1000);
            assert.notEqual(body.principal.last_ip, undefined);
            assert.equal(body.principal.password, undefined);

            done();
        });
    });

    it('should return failed authorization for wrong password', function(done) {
        request.post(core.config.principals_endpoint + '/auth', {
          json: {
              type: 'user',
              email: 'user@server.org',
              password: 'WRONGPASSWORD'
          }
        }, function(err, resp, body) {
            assert(!err);

            assert.equal(resp.statusCode, 401);
            assert.equal(body.accessToken, undefined);
            assert.notEqual(body.error, undefined);

            assert.equal(body.error.statusCode, 401);
            assert.notEqual(body.error.message, undefined);

            done();
        });
    });

    it('should allow updates to a principals name', function(done) {
        core.fixtures.models.principals.device.name = "my camera";

        request.put(core.config.principals_endpoint + "/" + core.fixtures.models.principals.device.id, {
            headers: {
                Authorization: core.fixtures.models.accessTokens.service.toAuthHeader()
            },
            json: core.fixtures.models.principals.device
        }, function(err, resp, body) {
            assert(!err);

            assert.ifError(err);
            assert.equal(resp.statusCode, 200);

            assert.equal(body.principal.name, "my camera");

            done();
        });
    });

    it('should allow service to impersonate user principal', function(done) {
        request.post(core.config.principals_endpoint + '/impersonate', {
            headers: {
                Authorization: core.fixtures.models.accessTokens.service.toAuthHeader()
            },
            json: core.fixtures.models.principals.user
        }, function(err, resp, body) {
            assert(!err);

            assert.equal(resp.statusCode, 200);
            assert.notEqual(body.accessToken.token, undefined);

            if (resp.headers['x-n2-set-access-token']) {
              var headerToken = JSON.parse(resp.headers['x-n2-set-access-token']);
              assert.notEqual(headerToken.token, body.accessToken.token);
            }

            done();
        });
    });

    it('should login device principal using secret endpoint', function (done) {
        var secretAuthDevice = core.fixtures.models.principals.secretAuthDevice;

        request.post(core.config.principals_endpoint + '/secret/auth', {
            json: {
                type: 'device',
                method: 'secret',
                id: secretAuthDevice.id,
                secret: secretAuthDevice.secret
            }
        }, function(err, resp, body) {
            assert(!err);
            assert.equal(resp.statusCode, 200);
            assert(body.accessToken.token);

            assert(body.principal.last_ip);
            assert(!body.principal.secret);
            done();
        });
     });

    it('should allow user to impersonate anotherUser principal', function(done) {
        request.post(core.config.principals_endpoint + '/impersonate', {
            headers: {
                Authorization: core.fixtures.models.accessTokens.user.toAuthHeader()
            },
            json: core.fixtures.models.principals.anotherUser
        }, function(err, resp, body) {
            assert(!err);

            assert.equal(resp.statusCode, 200);
            assert(body.accessToken.token);

            done();
        });
    });

    it('should not allow anotherUser to impersonate user principal', function(done) {
        request.post(core.config.principals_endpoint + '/impersonate', {
            headers: {
                Authorization: core.fixtures.models.accessTokens.anotherUser.toAuthHeader()
            },
            json: core.fixtures.models.principals.user
        }, function(err, resp, body) {
            assert(!err);

            assert.equal(resp.statusCode, 403);
            assert(!body.accessToken);

            done();
        });
    });

    it('should login user principal', function(done) {
        request.post(core.config.principals_endpoint + '/user/auth', {
            json: {
                type: 'user',
                email: 'anotheruser@server.org',
                password: 'sEcReTO66'
            }
        }, function(err, resp, body) {
            assert(!err);

            assert.equal(resp.statusCode, 200);
            assert(body.accessToken.token);

            assert.equal(Date.parse(body.principal.last_connection) > core.fixtures.models.principals.user.last_connection.getTime(), true);
            assert(body.principal.last_ip);
            assert(!body.principal.password);

            done();
        });
    });

    it('should return failed authorization for wrong password', function(done) {
        request.post(core.config.principals_endpoint + '/user/auth', {
          json: {
              type: 'user',
              email: 'user@server.org',
              password: 'WRONGPASSWORD'
          }
        }, function(err, resp, body) {
            assert(!err);

            assert.equal(resp.statusCode, 401);
            assert(!body.accessToken);
            assert(body.error);

            assert.equal(body.error.statusCode, 401);
            assert(body.error.message);

            done();
        });
    });

    it('should allow admin user to create accessToken for another principal', function(done) {
        request.post(core.config.principals_endpoint + '/accessToken', {
            headers: {
                Authorization: core.fixtures.models.accessTokens.user.toAuthHeader()
            },
            json: {
                principal_id: core.fixtures.models.principals.device.id,
                expires: new Date(2050,1,1).getTime()
            }
        }, function(err, resp, body) {
            assert(!err);

            assert.equal(resp.statusCode, 200);

            assert(body.accessToken.token);
            assert.equal(Date.parse(body.accessToken.expires_at), new Date(2050, 1, 1).getTime());
            done();
        });
    });
});