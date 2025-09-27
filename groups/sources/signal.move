module groups::signal;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::table::{Self, Table};
use std::string::String;

const EInvalidDescriptionLen: u64 = 1;
const EConfidenceOutOfRange: u64 = 2;

const MIN_DESC_LEN: u64 = 5;
const MAX_DESC_LENTH: u64 = 1000;
const MIN_CONFIDENCE: u8 = 1;
const MAX_CONFIDENCE: u8 = 10;

public struct Signal has key, store {
    id: UID,
    caller: address,
    token_address: vector<u8>, // encrypted token address
    bullish: bool,
    confidence: u8, // 1-10
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
    }
}

