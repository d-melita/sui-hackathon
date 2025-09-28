module groups::treasury;

use sui::balance::{Balance};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::table::{Self, Table};

const EInsufficientBalance: u64 = 1;
const EInvalidDeposit: u64 = 2;
const EInvalidWithdraw: u64 = 3;
const EUserNotInHoldings: u64 = 4;

public struct Treasury has key, store {
    id: UID,
    balance: Balance<SUI>,
    holdings: Table<address, u64>, // sum(holdings) must always equal balance.value
}

public(package) fun create_treasury(initial: Coin<SUI>, ctx: &mut TxContext): Treasury {
    let initial_amount = coin::value(&initial);
    let initial_balance = initial.into_balance();
    let mut holdings = table::new<address, u64>(ctx);
    
    // Record the initial depositor's holdings
    let depositor = ctx.sender();
    holdings.add(depositor, initial_amount);
    
    Treasury {
        id: object::new(ctx),
        balance: initial_balance,
        holdings,
    }
}

public(package) fun deposit(treasury: &mut Treasury, coin: Coin<SUI>, ctx: &TxContext) {
    assert!(coin::value(&coin) > 0, EInvalidDeposit);

    let deposit_balance = coin.into_balance();
    let user_address = ctx.sender();

    if (!treasury.holdings.contains(user_address)) {
        treasury.holdings.add(user_address, deposit_balance.value());
    } else {
        let user_balance = &mut treasury.holdings[user_address];
        *user_balance = *user_balance + deposit_balance.value();
    };
    treasury.balance.join(deposit_balance);
}


public(package) fun withdraw(treasury: &mut Treasury, amount: u64, ctx: &mut TxContext) {
    let user_address = ctx.sender();
    assert!(treasury.holdings.contains(user_address), EUserNotInHoldings);
    
    let user_balance = &mut treasury.holdings[user_address];
    assert!(treasury.balance.value() >= amount, EInvalidWithdraw);
    assert!(amount > 0 && amount <= *user_balance, EInsufficientBalance);
    

    *user_balance = *user_balance - amount;

    let coin = coin::take(&mut treasury.balance, amount, ctx);
    transfer::public_transfer(coin, user_address); // Issue?
}

public(package) fun getUserHoldings(treasury: &Treasury, user: address): u64 {
    if (!treasury.holdings.contains(user)) {
        0
    } else {
        treasury.holdings[user]
    }
}

/// Get the total balance in the treasury
public fun get_total_balance(treasury: &Treasury): u64 {
    treasury.balance.value()
}
