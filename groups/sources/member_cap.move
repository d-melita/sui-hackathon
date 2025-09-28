module groups::member_cap;

use groups::admin_cap::AdminCap;

const ENotAnAdmin: u64 = 0;
const EVectorsLengthMismatch: u64 = 1;
const ENotInGroup: u64 = 2;

/// Group Member cap
public struct MemberCap has key {
    id: UID,
    group_id: ID,
}

/// Mint a new MemberCap with the specified group_id
/// This should be callable only when adding members to a Group
public(package) fun mint(group_id: ID, ctx: &mut TxContext): MemberCap {
    MemberCap { id: object::new(ctx), group_id }
}

/// Burn the MemberCap
/// This should only be callable by a group.remove function,
/// because we don't want to arbitrarily allow people to burn their MemberCap.
/// We also want to handle any relevant tracking in the internals of the Group object.
public(package) fun burn(cap: MemberCap) {
    let MemberCap { id, group_id: _ } = cap;
    object::delete(id)
}

/// Transfer a MemberCap to the specified address.
/// Should only be called by a Group Admin, after a Group is created and shared.
public fun transfer_to_recipient(cap: MemberCap, admin_cap: &AdminCap, recipient: address) {
    assert!(cap.group_id == admin_cap.group_id(), ENotAnAdmin);
    transfer::transfer(cap, recipient)
}

public fun member_transfer_to_recipient(new_cap: MemberCap, member_cap: &MemberCap, recipient: address) {
    assert!(new_cap.group_id == member_cap.group_id, ENotInGroup);
    transfer::transfer(new_cap, recipient)
}

public fun transfer_to_sender(self: MemberCap, ctx: &TxContext) {
    transfer::transfer(self, ctx.sender());
}

/// Transfer MemberCaps to the associated addresses
/// Should only be called by a Group Admin, after a Group is created and shared.
public fun transfer_member_caps(
    member_addresses: vector<address>,
    mut member_caps: vector<MemberCap>,
    admin_cap: &AdminCap,
) {
    assert!(member_addresses.length() == member_caps.length(), EVectorsLengthMismatch);
    let mut i = 0;
    let len = member_addresses.length();
    while (i < len) {
        let member_cap = member_caps.pop_back();
        assert!(member_cap.group_id == admin_cap.group_id(), ENotAnAdmin);
        member_cap.transfer_to_recipient(admin_cap, member_addresses[i]);
        i = i + 1;
    };
    member_caps.destroy_empty();
}

public(package) fun assert_cap(self: &MemberCap, group_id: ID) {
    assert!(self.group_id == group_id, ENotInGroup);
}

// Getters

public fun group_id(self: &MemberCap): ID {
    self.group_id
}