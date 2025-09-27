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

use groups::admin_cap::AdminCap;
use groups::member_cap::MemberCap;
use groups::owner_cap::OwnerCap;

//const EDuplicate: u64 = 1;
//const ENotInGroup: u64 = 2;
const ENotOpenGroup: u64 = 4;

const VERSION: u64 = 1;

/// Core on-chain community object
public struct Group has key {
    id: UID,
    version: u64,
    is_gated: bool,
    // TODO CHECK IF MAKES SENSE TO KEEP TRACK OF MEMBERS
    members: table::Table<ID, member::Member>,
}

public struct GroupCreated has copy, drop, store { group_id: ID, owner: address }

/// The flow is:
/// create_group()
///       -> share()
public fun new_group(
    gated: bool,
    ctx: &mut TxContext,
): Group {// group_id is 0 for now

    let group_uid = object::new(ctx);
    let owner_cap = owner_cap::mint(group_uid.to_inner(), ctx);
    let admin_cap = admin_cap::mint(group_uid.to_inner(), ctx);

    let group = Group {
        id: group_uid,
        version: VERSION,
        is_gated: gated,
        members: table::new<ID, member::Member>(ctx),
    };

    let gid = object::id(&group);
    event::emit(GroupCreated { group_id: gid, owner: ctx.sender() });
    owner_cap.transfer_to_sender(ctx);
    admin_cap.transfer_to_sender(ctx); // Owner is also an admin of the group
    group
}

entry public fun create_group(
    gated: bool,
    ctx: &mut TxContext,
) {
    let mut group = new_group(gated, ctx);
    add_new_member(&mut group, ctx.sender(), ctx);
    transfer::share_object(group);
}

/// Mint/bind membership — MVP without checks; add gates later
public fun join(
    group: &mut Group,
    ctx: &mut TxContext,
) {
    assert!(!group.is_gated, ENotOpenGroup);
    let member_cap = member_cap::mint(object::id(group), ctx);
    member_cap.transfer_to_sender(ctx);
    let user_address = ctx.sender();
    add_new_member(group, user_address, ctx);
}

// For private groups, mods can add/remove members - ???
public fun add_member(group: &mut Group, admin_cap: &AdminCap, account: address, ctx: &mut TxContext) {
    admin_cap::assert_cap(admin_cap, object::id(group));
    let member_cap = member_cap::mint(object::id(group), ctx);
    member_cap.transfer_to_recipient(admin_cap, account);
    add_new_member(group, account, ctx);
}

public fun leave(group: &mut Group, member_cap: MemberCap, member_id: ID) {
    assert!(!group.is_gated, ENotOpenGroup);
    member_cap::assert_cap(&member_cap, object::id(group));
    member_cap::burn(member_cap);
    remove_member_by_id(group, member_id);
}

public fun remove_member(group: &mut Group, admin_cap: &AdminCap, member_cap: MemberCap, member_id: ID) {
    admin_cap::assert_cap(admin_cap, object::id(group));
    member_cap::burn(member_cap);
    remove_member_by_id(group, member_id);
}

/// Promote a member to an admin - Only the group owner can do this
public fun promote_member_to_admin(group: &Group, owner_cap: &OwnerCap, member_cap: MemberCap, ctx: &mut TxContext) {
    owner_cap::assert_cap(owner_cap, object::id(group));
    member_cap::assert_cap(&member_cap, object::id(group));
    member_cap::burn(member_cap);
    let new_owner_cap = owner_cap::mint(object::id(group), ctx);
    owner_cap::transfer_to_sender(new_owner_cap, ctx);
}

/// Demote an admin to a member - Only the group owner can do this
public fun demote_admin_to_member(group: &Group, owner_cap: &OwnerCap, admin_cap: AdminCap, ctx: &mut TxContext) {
    owner_cap::assert_cap(owner_cap, object::id(group));
    admin_cap::assert_cap(&admin_cap, object::id(group));
    let new_member_cap = member_cap::mint(object::id(group), ctx);
    member_cap::transfer_to_sender(new_member_cap, ctx);
    admin_cap::burn(admin_cap); // Admin is demoted to member
}

public fun add_new_member(
    group: &mut Group,
    user_address: address,
    ctx: &mut TxContext,
) {
    let member = member::new_member(ctx, user_address, object::id(group));
    let member_id = object::id(&member);
    table::add(&mut group.members, member_id, member);
}

public fun remove_member_by_id(
    group: &mut Group,
    member_id: ID,
) {
    let member = table::remove(&mut group.members, member_id);
    member::delete_member(member);
}


/*
/// Emit a lightweight signal for bots/UIs.
public fun emit_signal(group: &Group, _cap: &PostCap, sig_type: u8, payload: vector<u8>, ts_ms: u64) {
    let sender = tx_context::sender(ctx);
    signal::emit_signal(object::id(&group), sender, sig_type, payload, ts_ms);
}
*/
