module groups::group;

use groups::member_cap;
use groups::admin_cap;
use groups::owner_cap;
use groups::member;
//use groups::governance;
//use groups::membership;
//use groups::message;
//use groups::signal;
//use sui::address;
use sui::event;
use sui::table;
use sui::coin::Coin;
use sui::sui::SUI;
use std::string::String;


use groups::admin_cap::AdminCap;
use groups::member_cap::MemberCap;
use groups::owner_cap::OwnerCap;
use groups::treasury;
use groups::signal;
use groups::voting;


const ENotAllowed: u64 = 1;
const ENotInGroup: u64 = 2;
const EDuplicate: u64 = 3;
const ENotOpenGroup: u64 = 4;
const ETreasuryExists: u64 = 5;
const ETreasuryNotExists: u64 = 6;

const VERSION: u64 = 1;

/// Core on-chain community object
public struct Group has key {
    id: UID,
    version: u64,
    is_gated: bool,
    members: table::Table<address, member::Member>,
    treasury: Option<treasury::Treasury>, // Optional treasury for the group
    signals: table::Table<ID, signal::Signal>, // Signals sent to the group  
    current_polls: table::Table<ID, voting::Vote>, // Votes created in the group
    past_polls: table::Table<ID, voting::VoteResult>, // Past votes created in the group
}

public struct GroupCreated has copy, drop, store { group_id: ID, owner: address }

/// The flow is:
/// create_group()
///       -> share()
public fun new_group(
    gated: bool,
    ctx: &mut TxContext,
): Group {

    let group_uid = object::new(ctx);
    let owner_cap = owner_cap::mint(group_uid.to_inner(), ctx);
    let admin_cap = admin_cap::mint(group_uid.to_inner(), ctx);

    let group = Group {
        id: group_uid,
        version: VERSION,
        is_gated: gated,
        members: table::new<address, member::Member>(ctx),
        treasury: option::none(),
        signals: table::new<ID, signal::Signal>(ctx),
        current_polls: table::new<ID, voting::Vote>(ctx),
        past_polls: table::new<ID, voting::VoteResult>(ctx),
    };

    let gid = object::id(&group);
    event::emit(GroupCreated { group_id: gid, owner: ctx.sender() });
    owner_cap.transfer_to_sender(ctx);
    admin_cap.transfer_to_sender(ctx); // Owner is also an admin of the group
    group
}

entry fun create_group(
    gated: bool,
    ctx: &mut TxContext,
) {
    let mut group = new_group(gated, ctx);
    add_new_member(&mut group, ctx.sender(), 2, ctx);
    transfer::share_object(group);
}

/// Mint/bind membership — MVP without checks; add gates later
entry fun join(
    group: &mut Group,
    ctx: &mut TxContext,
) {
    assert!(!group.is_gated, ENotOpenGroup); // Only for open groups
    assert!(!group.members.contains(ctx.sender()), EDuplicate); // Check if already a member, if so error

    let member_cap = member_cap::mint(object::id(group), ctx);
    member_cap.transfer_to_sender(ctx);

    let user_address = ctx.sender();
    add_new_member(group, user_address, 0, ctx);
}

// For private groups, mods can add/remove members - owner should pass its admin cap
entry fun add_member(group: &mut Group, admin_cap: &AdminCap, user_address: address, ctx: &mut TxContext) {
    admin_cap::assert_cap(admin_cap, object::id(group)); // check if admin cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && (group.members.borrow(ctx.sender()).get_role() == 2 || group.members.borrow(ctx.sender()).get_role() == 3), ENotAllowed); // check if holder of cap is a valid admin/owner - it might have left, been demoted, or demoted and removed

    assert!(!group.members.contains(user_address), EDuplicate); // check if the user to add is already a member, if so error

    let member_cap = member_cap::mint(object::id(group), ctx);
    member_cap.transfer_to_recipient(admin_cap, user_address);
    add_new_member(group, user_address, 0, ctx);
}

entry fun leave(group: &mut Group, ctx: &TxContext) {
    assert!(group.members.contains(ctx.sender()), ENotInGroup); // if user not in group, they cannot leave - any type of user can leave

    let user_address = ctx.sender();
    remove_member_by_address(group, user_address);
}

entry fun remove_member(group: &mut Group, admin_cap: &AdminCap, user_address: address, ctx: &TxContext) {
    admin_cap::assert_cap(admin_cap, object::id(group)); // check if admin cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && (group.members.borrow(ctx.sender()).get_role() == 1 || group.members.borrow(ctx.sender()).get_role() == 2), ENotAllowed); // check if holder of cap is a valid admin/owner - it might have left, been demoted, or demoted and removed

    assert!(group.members.contains(user_address), ENotInGroup);
    remove_member_by_address(group, user_address);
}

// TREASURY FUNCTIONS
entry fun init_treasury(group: &mut Group, admin_cap: &AdminCap, initial: Coin<SUI>, ctx: &mut TxContext) {
    admin_cap::assert_cap(admin_cap, object::id(group)); // check if admin cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && (group.members.borrow(ctx.sender()).get_role() == 1 || group.members.borrow(ctx.sender()).get_role() == 2), ENotAllowed); // check if holder of cap is a valid admin/owner - it might have left, been demoted, or demoted and removed

    assert!(group.treasury.is_none(), ETreasuryExists); // check if treasury already exists, if so error

    let treasury = treasury::create_treasury(initial, ctx);
    group.treasury.fill(treasury);
}

entry fun deposit_to_treasury(group: &mut Group, admin_cap: &AdminCap, coin: Coin<SUI>, ctx: &TxContext) {
    admin_cap::assert_cap(admin_cap, object::id(group)); // check if admin cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && (group.members.borrow(ctx.sender()).get_role() == 1 || group.members.borrow(ctx.sender()).get_role() == 2), ENotAllowed); // check if holder of cap is a valid admin/owner - it might have left, been demoted, or demoted and removed

    assert!(group.treasury.is_some(), ETreasuryNotExists); // check if treasury exists, if not error


    let treasury = group.treasury.borrow_mut();
    treasury.deposit(coin, ctx);
}

entry fun withdraw_from_treasury(group: &mut Group, admin_cap: &AdminCap, amount: u64, ctx: &mut TxContext) {
    admin_cap::assert_cap(admin_cap, object::id(group)); // check if admin cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && (group.members.borrow(ctx.sender()).get_role() == 1 || group.members.borrow(ctx.sender()).get_role() == 2), ENotAllowed); // check if holder of cap is a valid admin/owner - it might have left, been demoted, or demoted and removed

    assert!(group.treasury.is_some(), ETreasuryNotExists); // check if treasury exists, if not error

    let treasury = group.treasury.borrow_mut();
    treasury.withdraw(amount, ctx);
}

public fun get_user_holdings(group: &Group, user: address, ctx: &mut TxContext): u64 {
    assert!(group.members.contains(user), ENotInGroup);
    assert!(group.treasury.is_some(), ETreasuryNotExists);
    assert!(group.members.contains(ctx.sender()), ENotAllowed);

    let treasury = group.treasury.borrow();
    treasury.getUserHoldings(user)
}

// SIGNAL FUNCTIONS

entry fun create_signal(group: &mut Group, admin_cap: &AdminCap, token_address: vector<u8>, bullish: bool, confidence: u8, ctx: &mut TxContext) {
    admin_cap::assert_cap(admin_cap, object::id(group)); // check if admin cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && (group.members.borrow(ctx.sender()).get_role() == 1 || group.members.borrow(ctx.sender()).get_role() == 2), ENotAllowed); // check if holder of cap is a valid admin/owner - it might have left, been demoted, or demoted and removed

    let signal = signal::create_signal(token_address, bullish, confidence, ctx);
    group.signals.add(object::id(&signal), signal);
}

public fun get_signal(group: &Group, signal_id: ID, ctx: &mut TxContext): &signal::Signal {
    assert!(group.members.contains(ctx.sender()), ENotAllowed); // any member can view signals
    assert!(group.signals.contains(signal_id), ENotInGroup); // check if signal exists
    group.signals.borrow(signal_id)
}

entry fun upvote_signal(group: &mut Group, signal_id: ID, ctx: &TxContext) { // check if member cap is valid for the group
    assert!(group.members.contains(ctx.sender()), ENotAllowed); // check if holder of cap is a valid member - it might have left, been promoted, or promoted and removed

    assert!(group.signals.contains(signal_id), ENotInGroup); // check if signal exists
    let signal = group.signals.borrow_mut(signal_id);
    signal.upvote();
}

entry fun downvote_signal(group: &mut Group, signal_id: ID, ctx: &TxContext) { // check if member cap is valid for the group
    assert!(group.members.contains(ctx.sender()), ENotAllowed); // check if holder of cap is a valid member - it might have left, been promoted, or promoted and removed

    assert!(group.signals.contains(signal_id), ENotInGroup); // check if signal exists
    let signal = group.signals.borrow_mut(signal_id);
    signal.downvote();
}

// VOTING FUNCTIONS

entry fun create_vote(
    group: &mut Group,
    admin_cap: &AdminCap,
    title: String,
    description: String,
    voters: vector<address>,
    options: u8,
    key_servers: vector<address>,
    public_keys: vector<vector<u8>>,
    threshold: u8,
    ctx: &mut TxContext,
) {
    admin_cap::assert_cap(admin_cap, object::id(group)); // check if admin cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && (group.members.borrow(ctx.sender()).get_role() == 1 || group.members.borrow(ctx.sender()).get_role() == 2), ENotAllowed); // check if holder of cap is a valid admin/owner - it might have left, been demoted, or demoted and removed

    let vote = voting::create_vote(title, description, voters, options, key_servers, public_keys, threshold, ctx);
    group.current_polls.add(object::id(&vote), vote);
}

entry fun cast_vote(
    group: &mut Group,
    vote_id: ID,
    encrypted_ballot: vector<u8>,
    ctx: &mut TxContext,
) {
    assert!(group.members.contains(ctx.sender()), ENotAllowed); // check if holder of cap is a valid member - it might have left, been promoted, or promoted and removed

    assert!(group.current_polls.contains(vote_id), ENotInGroup); // check if vote exists
    let vote = group.current_polls.borrow_mut(vote_id);
    vote.cast_vote(encrypted_ballot, ctx);
}

entry fun finalize_vote(
    group: &mut Group,
    admin_cap: &AdminCap,
    vote_id: ID,
    derived_keys: vector<vector<u8>>,
    key_servers: vector<address>,
    ctx: &TxContext,
) {
    admin_cap::assert_cap(admin_cap, object::id(group)); // check if admin cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && (group.members.borrow(ctx.sender()).get_role() == 1 || group.members.borrow(ctx.sender()).get_role() == 2), ENotAllowed); // check if holder of cap is a valid admin/owner - it might have left, been demoted, or demoted and removed

    assert!(group.current_polls.contains(vote_id), ENotInGroup); // check if vote exists
    let mut vote = group.current_polls.remove(vote_id);

    let result = vote.finalize_vote(&derived_keys, &key_servers);
    group.past_polls.add(vote_id, result);

    vote.delete();
}






// ADDITIONAL FUNCTIONS FOR ROLES MANAGEMENT

/// Promote a member to an admin - Only the group owner can do this
entry fun promote_member_to_admin(group: &mut Group, owner_cap: &OwnerCap, user_address: address, ctx: &mut TxContext) {
    owner_cap::assert_cap(owner_cap, object::id(group)); // check if owner cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && group.members.borrow(ctx.sender()).get_role() == 2, ENotAllowed); // check if holder of cap is the owner - it might have left

    assert!(group.members.contains(user_address) && group.members.borrow(user_address).get_role() == 0, ENotInGroup); // check if the user to promote is a member and is present in the group

    // create a new admin cap and transfer to the user
    let new_admin_cap = admin_cap::mint(object::id(group), ctx);
    admin_cap::transfer_to_sender(new_admin_cap, ctx);

    // update the table entry for the user to set role to admin
    let member = &mut group.members[user_address];
    member.setRole(1);
}

/// Demote an admin to a member - Only the group owner can do this
entry fun demote_admin_to_member(group: &mut Group, owner_cap: &OwnerCap, user_address: address, ctx: &mut TxContext) {
    owner_cap::assert_cap(owner_cap, object::id(group)); // check if owner cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && group.members.borrow(ctx.sender()).get_role() == 2, ENotAllowed); // check if holder of cap is the owner - it might have left


    assert!(group.members.contains(user_address) && group.members.borrow(user_address).get_role() == 1, ENotInGroup); // check if the user to demote is an admin and is present in the group

    // create a new member cap and transfer to the user
    let new_member_cap = member_cap::mint(object::id(group), ctx);
    member_cap::transfer_to_sender(new_member_cap, ctx);

    // update the table entry for the user to set role to member
    let member = &mut group.members[user_address];
    member.setRole(0);
}

/// adds a member to the group table
public fun add_new_member(
    group: &mut Group,
    user_address: address,
    role: u8,
    ctx: &mut TxContext,
) {
    let member = member::new_member(ctx, user_address, object::id(group), role);
    group.members.add(user_address, member)
}

/// removes a member from the group table by their address
public fun remove_member_by_address(
    group: &mut Group,
    user_address: address,
) {
    let member = table::remove(&mut group.members, user_address);
    member::delete_member(member);
}

entry fun member_add_member(group: &mut Group, user_address: address, member_cap: &MemberCap, ctx: &mut TxContext) {
    member_cap::assert_cap(member_cap, object::id(group)); // check if member cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && group.members.borrow(ctx.sender()).get_role() == 0, ENotAllowed); // check if holder of cap is a valid member - it might have left, been promoted, or promoted and removed

    assert!(!group.members.contains(user_address), EDuplicate); // check if the user to add is already a member, if so error

    let new_member_cap = member_cap::mint(object::id(group), ctx);
    member_cap::member_transfer_to_recipient(new_member_cap, member_cap, user_address);
    add_new_member(group, user_address, 0, ctx);
}
