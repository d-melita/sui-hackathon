module groups::signal;

const EConfidenceOutOfRange: u64 = 2;

const MIN_RATING: u8 = 0;
const MAX_RATING: u8 = 100;
const MIN_CONFIDENCE: u8 = 1;
const MAX_CONFIDENCE: u8 = 10;

public struct Signal has key, store {
    id: UID,
    caller: address,
    token_address: vector<u8>, // encrypted token address
    bullish: bool,
    confidence: u8,
    rating: u8, // 1-100, voted by other members
}

public fun create_signal(token_address: vector<u8>, bullish: bool, confidence: u8, ctx: &mut TxContext): Signal {
    // let token_address = parse_encrypted_object(token_address);
    assert!(confidence >= MIN_CONFIDENCE && confidence <= MAX_CONFIDENCE, EConfidenceOutOfRange);
    Signal {
        id: object::new(ctx),
        caller: ctx.sender(),
        token_address,
        bullish,
        confidence,
        rating: 0,
    }
}

public(package) fun upvote(signal: &mut Signal) {
    if (signal.rating < MAX_RATING) {
        signal.rating = signal.rating + 1;
    }
}

public(package) fun downvote(signal: &mut Signal) {
    if (signal.rating > MIN_RATING) {
        signal.rating = signal.rating - 1;
    }
}

// Getter functions for testing
public fun get_caller(signal: &Signal): address {
    signal.caller
}

public fun get_token_address(signal: &Signal): &vector<u8> {
    &signal.token_address
}

public fun get_bullish(signal: &Signal): bool {
    signal.bullish
}

public fun get_confidence(signal: &Signal): u8 {
    signal.confidence
}

public fun get_rating(signal: &Signal): u8 {
    signal.rating
}


