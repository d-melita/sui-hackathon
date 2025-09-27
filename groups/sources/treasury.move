module groups::treasury;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::table::{Self, Table};

const EInsufficientBalance: u64 = 1;
const EInvalidWithdraw: u64 = 2;

public struct Treasury has key, store {
    id: UID,
    balance: Balance<SUI>,
    fee_bps: u16, // 0-10000
    holdings: Table<address, u64>, // sum(holdings) must always equal balance.value
}

public fun create_treasury(initial: Coin<SUI>, fee_bps: u16, ctx: &mut TxContext): Treasury {
    Treasury {
        id: object::new(ctx),
        balance: initial.into_balance(),
        fee_bps,
        holdings: table::new<address, u64>(ctx),
    }
}

public fun deposit(treasury: &mut Treasury, coin: Coin<SUI>, ctx: &mut TxContext) {
    assert!(coin::value(&coin) > 0, EInsufficientBalance);

    let deposit_balance = coin.into_balance();
    let u_address = ctx.sender();

    if (!treasury.holdings.contains(u_address)) {
        treasury.holdings.add(u_address, deposit_balance.value());
    } else {
        let user_balance = &mut treasury.holdings[u_address];
        *user_balance = *user_balance + deposit_balance.value();
    };
    treasury.balance.join(deposit_balance);
    assert!(balance::value(&treasury.balance) == treasury.holdings[u_address], EInvalidWithdraw);
}

/*
public fun withdraw(treasury: &mut Treasury, amount: u64, ctx: &mut TxContext): Coin<SUI> {
    let user_address = ctx.sender();
    let user_balance = table::borrow_mut(&treasury.holdings, user_address);
    assert!(amount > 0 && amount <= balance::value(&treasury.balance), EInsufficientBalance);

    let fee = (amount * treasury.fee_bps as u64) / 10000;
    let total = amount + fee;
   //assert!(total <= balance.value(&treasury.balance), EInsufficientBalance);

    //let coin = balance::withdraw(&mut treasury.balance, total);
}
*/
