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

const ENotAllowed: u64 = 1;
const ENotInGroup: u64 = 2;
const EDuplicate: u64 = 3;
const ENotOpenGroup: u64 = 4;

const VERSION: u64 = 1;

/// Core on-chain community object
public struct Group has key {
    id: UID,
    version: u64,
    is_gated: bool,
    members: table::Table<address, member::Member>,
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
public fun join(
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
public fun add_member(group: &mut Group, admin_cap: &AdminCap, user_address: address, ctx: &mut TxContext) {
    admin_cap::assert_cap(admin_cap, object::id(group)); // check if admin cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && (group.members.borrow(ctx.sender()).get_role() == 2 || group.members.borrow(ctx.sender()).get_role() == 3), ENotAllowed); // check if holder of cap is a valid admin/owner - it might have left, been demoted, or demoted and removed

    assert!(!group.members.contains(user_address), EDuplicate); // check if the user to add is already a member, if so error

    let member_cap = member_cap::mint(object::id(group), ctx);
    member_cap.transfer_to_recipient(admin_cap, user_address);
    add_new_member(group, user_address, 0, ctx);
}

public fun leave(group: &mut Group, ctx: &mut TxContext) {
    assert!(group.members.contains(ctx.sender()), ENotInGroup); // if user not in group, they cannot leave - any type of user can leave

    let user_address = ctx.sender();
    remove_member_by_address(group, user_address);
}

public fun remove_member(group: &mut Group, admin_cap: &AdminCap, user_address: address, ctx: &mut TxContext) {
    admin_cap::assert_cap(admin_cap, object::id(group)); // check if admin cap is valid for the group
    assert!(group.members.contains(ctx.sender()) && (group.members.borrow(ctx.sender()).get_role() == 1 || group.members.borrow(ctx.sender()).get_role() == 2), ENotAllowed); // check if holder of cap is a valid admin/owner - it might have left, been demoted, or demoted and removed

    assert!(group.members.contains(user_address), ENotInGroup);
    remove_member_by_address(group, user_address);
}

/// Promote a member to an admin - Only the group owner can do this
public fun promote_member_to_admin(group: &mut Group, owner_cap: &OwnerCap, user_address: address, ctx: &mut TxContext) {
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
public fun demote_admin_to_member(group: &mut Group, owner_cap: &OwnerCap, user_address: address, ctx: &mut TxContext) {
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


/*
/// Emit a lightweight signal for bots/UIs.
public fun emit_signal(group: &Group, _cap: &PostCap, sig_type: u8, payload: vector<u8>, ts_ms: u64) {
    let sender = tx_context::sender(ctx);
    signal::emit_signal(object::id(&group), sender, sig_type, payload, ts_ms);
}
*/
