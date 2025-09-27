module groups::group;

use groups::member_cap;
use groups::admin_cap;
//use groups::governance;
//use groups::membership;
//use groups::message;
//use groups::signal;
//use sui::address;
use sui::event;
//use sui::table;
use groups::admin_cap::AdminCap;
use groups::member_cap::MemberCap;

//const EDuplicate: u64 = 1;
//const ENotInGroup: u64 = 2;
const ENotCreator: u64 = 3;
const ENotOpenGroup: u64 = 4;

const VERSION: u64 = 1;

/// Core on-chain community object
public struct Group has key {
    id: UID,
    version: u64,
    owner: address, // can be shared/DAO later
    is_gated: bool,
    // TODO CHECK IF MAKES SENSE TO KEEP TRACK OF MEMBERS
}

public struct GroupCreated has copy, drop, store { group_id: ID, owner: address }

/// The flow is:
/// create_group()
///       -> share()
public fun create_group(
    gated: bool,
    ctx: &mut TxContext,
): Group {
    let group_uid = object::new(ctx);
    let admin_cap = admin_cap::mint(group_uid.to_inner(), ctx);
    let group = Group {
        id: group_uid,
        version: VERSION,
        owner: tx_context::sender(ctx),
        is_gated: gated,
    };
    let gid = object::id(&group);
    event::emit(GroupCreated { group_id: gid, owner: group.owner });
    admin_cap.transfer_to_sender(ctx);
    group
}

public fun share(self: Group, ctx: &mut TxContext) {
    assert!(self.owner == tx_context::sender(ctx), ENotCreator);
    transfer::share_object(self);
}

/// Mint/bind membership — MVP without checks; add gates later
public fun join(
    group: &mut Group,
    ctx: &mut TxContext,
) {
    assert!(!group.is_gated, ENotOpenGroup);
    let member_cap = member_cap::mint(object::id(group), ctx);
    member_cap.transfer_to_sender(ctx);
}

public fun leave(group: &mut Group, member_cap: MemberCap) {
    assert!(!group.is_gated, ENotOpenGroup);
    member_cap::assert_cap(&member_cap, object::id(group));
    member_cap::burn(member_cap);
}

// For private groups, mods can add/remove members - ???
public fun add_member(group: &mut Group, admin_cap: &AdminCap, account: address, ctx: &mut TxContext) {
    admin_cap::assert_cap(admin_cap, object::id(group));
    let member_cap = member_cap::mint(object::id(group), ctx);
    member_cap.transfer_to_recipient(admin_cap, account);
}

public fun remove_member(group: &mut Group, admin_cap: &AdminCap, member_cap: MemberCap) {
    admin_cap::assert_cap(admin_cap, object::id(group));
    member_cap::burn(member_cap);
}

/*
/// Emit a lightweight signal for bots/UIs.
public fun emit_signal(group: &Group, _cap: &PostCap, sig_type: u8, payload: vector<u8>, ts_ms: u64) {
    let sender = tx_context::sender(ctx);
    signal::emit_signal(object::id(&group), sender, sig_type, payload, ts_ms);
}
*/
