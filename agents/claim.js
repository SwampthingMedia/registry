session.onMessage(function(message) {
    if (message.message_type == "claim") {
        log.info("claimAgent: claim agent processing message");

        nitrogen.Message.find(session, { _id: message.response_to }, function(err, ipMatches) {

            if (err || ipMatches.length == 0) {
                log.error("claimAgent: couldn't find ip_match claim was in response to: " + err);
                return;
            }

            // should only be one
            ipMatches.forEach(function(ipMatch) {
                if (ipMatch.body.key !== message.body.key) {
                    log.error("claimAgent: key does not match ip match message, ignoring.");
                    return;
                }

                nitrogen.Message.find(session, { _id: message.body.principal }, function(err, claimedPrincipal) {
                    if (err || !claimedPrincipal) {
                        log.error("claimAgent: couldn't find message claim was in response to: " + err);
                        return;
                    }

                    if (claimedPrincipal.owner) {
                        log.warn("claimAgent: principal " + claimPrincipal.id + " is already owned by " + claimPrincipal.owner + ": ignoring claim request.");
                        return;
                    }

                    claimedPrincipal.owner = message.from;
                    claimedPrincipal.save(session);
                });
            });
        });
    }
});