module groups::voting;

use seal::bf_hmac_encryption::{
    EncryptedObject,
    VerifiedDerivedKey,
    PublicKey,
    decrypt,
    new_public_key,
    verify_derived_keys,
    parse_encrypted_object
};
use sui::bls12381::g1_from_bytes;
//use sui::table::{Self, Table};

const EInvalidVote: u64 = 1;
const EVoteNotDone: u64 = 2;
const EAlreadyFinalized: u64 = 3;
const ENotEnoughKeys: u64 = 4;

public struct Vote has key {
    id: UID,
    //voters2: Table<address, Option<EncryptedObject>> Used to check if address requesting encryption is part of voters. Have to initialize by adding 1 by 1?
    title: String,
    description: String,
    /// The eligble voters of the vote.
    voters: vector<address>,
    /// The number of options the voters can vote for.
    options: u8,
    /// This holds the encrypted votes assuming the same order as the `voters` vector.
    votes: vector<Option<EncryptedObject>>,
    /// Is the vote finalixed yet
    is_finalized: bool,
    /// The key servers that must be used for the encryption of the votes.
    key_servers: vector<address>,
    /// The public keys for the key servers in the same order as `key_servers`.
    public_keys: vector<vector<u8>>,
    /// The threshold for the vote.
    threshold: u8,
}

// The id of a vote is the id of the object.
public fun id(v: &Vote): vector<u8> {
    object::id(v).to_bytes()
}

/// The result of a vote.
public struct VoteResult has drop, store {
    vote_id: address,
    // result[0] = num of blank votes, result[1] = num of votes for option 1, result[2] = num of votes for option 2, etc.
    result: vector<u64>,
}

public fun votes_for_option(result: &VoteResult, option: u8): u64 {
    result.result[option as u64]
}

public fun vote_id(result: &VoteResult): address {
    result.vote_id
}

public fun winner(result: &VoteResult): u8 {
    let (mut max_votes, mut option) = (0u64, 0u8);
    result.result.length().do!(|i| {
        let votes = result.result[i];
        if (votes > max_votes) {
            max_votes = votes;
            option = i as u8;
        };
    });
    option
}

#[test_only]
public fun destroy_for_testing(v: Vote) {
    let Vote { id, .. } = v;
    object::delete(id);
}

/// Create a vote.
/// The associated key-ids are [pkg id][vote id].
public fun create_vote(
    title: String,
    description: String,
    voters: vector<address>,
    options: u8,
    key_servers: vector<address>,
    public_keys: vector<vector<u8>>,
    threshold: u8,
    ctx: &mut TxContext,
): Vote {
    assert!(threshold <= key_servers.length() as u8);
    assert!(key_servers.length() == public_keys.length());
    Vote {
        id: object::new(ctx),
        title,
        description,
        voters,
        key_servers,
        public_keys,
        threshold,
        is_finalized: false,
        votes: vector::tabulate!(voters.length(), |_| option::none()),
        options,
    }
}

/// Cast a vote.
/// The encrypted object should be an encryption of a single u8 and have the senders address as aad.
public fun cast_vote(vote: &mut Vote, encrypted_vote: vector<u8>, ctx: &mut TxContext) {
    let encrypted_vote = parse_encrypted_object(encrypted_vote);

    // The voter id must be put as aad to ensure that an encrypted vote cannot be copied and cast by another voter.
    assert!(encrypted_vote.aad().borrow() == ctx.sender().to_bytes(), EInvalidVote);

    // All encrypted vote must have been encrypted using the same key servers and the same threshold.
    // We could allow the order of the key servers to be different, but for the sake of simplicity, we also require the same order.
    assert!(encrypted_vote.services() == vote.key_servers, EInvalidVote);
    assert!(encrypted_vote.threshold() == vote.threshold, EInvalidVote);

    // Check that the encryptions were created for this vote.
    assert!(encrypted_vote.id() == vote.id(), EInvalidVote);
    // assert!(encrypted_vote.package_id() == @groups, EInvalidVote); ??

    // This aborts if the sender is not a voter.
    let index = vote.voters.find_index!(|voter| voter == ctx.sender()).destroy_some();
    vote.votes[index].fill(encrypted_vote);
}

entry fun seal_approve(id: vector<u8>, vote: &Vote) {
    assert!(id == vote.id(), EInvalidVote);
    assert!(vote.votes.all!(|vote| vote.is_some()), EVoteNotDone);
}

/// Finalize a vote.
/// Updates the `result` field of the vote to hold the votes of the corresponding voters.
/// Aborts if the vote has already been finalized.
/// Aborts if there are not enough keys or if they are not valid, e.g. if they were derived for a different purpose.
/// In case the keys are valid but a vote, is invalid, decrypt will just set the corresponding result to none.
///
/// The given derived keys and key servers should be in the same order.
public fun finalize_vote(
    vote: &mut Vote,
    derived_keys: &vector<vector<u8>>,
    key_servers: &vector<address>,
): VoteResult {
    assert!(!vote.is_finalized, EAlreadyFinalized);
    assert!(key_servers.length() == derived_keys.length());
    assert!(derived_keys.length() as u8 >= vote.threshold, ENotEnoughKeys);

    // Public keys for the given derived keys
    // Verify the derived keys
    let verified_derived_keys: vector<VerifiedDerivedKey> = verify_derived_keys(
        &derived_keys.map_ref!(|k| g1_from_bytes(k)),
        @groups,
        vote.id(),
        &key_servers
            .map_ref!(|ks1| vote.key_servers.find_index!(|ks2| ks1 == ks2).destroy_some())
            .map!(|i| new_public_key(vote.key_servers[i].to_id(), vote.public_keys[i])),
    );

    // Public keys for all key servers
    let all_public_keys: vector<PublicKey> = vote
        .key_servers
        .zip_map!(vote.public_keys, |ks, pk| new_public_key(ks.to_id(), pk));

    // This aborts if there are not enough keys or if they are invalid, e.g. if they were derived for a different purpose.
    // However, in case the keys are valid but some of the encrypted objects, aka the votes, are invalid, decrypt will just return none for these votes.
    let mut result = vector::tabulate!(vote.options as u64, |_| 0);
    vote
        .votes
        .do_ref!(
            |v| v
                .and_ref!(|v| decrypt(v, &verified_derived_keys, &all_public_keys))
                .do_ref!(|decrypted| {
                    if (decrypted.length() == 1 && decrypted[0] < vote.options) {
                        let option = decrypted[0] as u64;
                        *&mut result[option] = result[option] + 1;
                    };
                }),
        );

    vote.is_finalized = true;
    VoteResult { vote_id: vote.id.to_address(), result }
}
