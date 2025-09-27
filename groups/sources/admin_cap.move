module groups::admin_cap;

const ENotAnAdmin: u64 = 0;

/// Channel Admin Capability
///
/// Used for initializing/building the Channel.
/// Soul Bound - Can be transferred via custom transfer function.
public struct AdminCap has key {
    id: UID,
    group_id: ID,
}

/// Mint a new AdminCap
/// This is meant to be called only when creating a new Channel.
public(package) fun mint(group_id: ID, ctx: &mut TxContext): AdminCap {
    AdminCap { id: object::new(ctx), group_id }
}

/// Burn the AdminCap
/// This should only be callable by a group.remove function,
/// because we don't want to arbitrarily allow people to burn their AdminCap.
/// We also want to handle any relevant tracking in the internals of the Group object.
public(package) fun burn(cap: AdminCap) {
    let AdminCap { id, group_id: _ } = cap;
    object::delete(id)
}

/// Transfer a AdminCap to the transaction sender.
public fun transfer_to_sender(self: AdminCap, ctx: &TxContext) {
    transfer::transfer(self, ctx.sender());
}

public fun assert_cap(self: &AdminCap, group_id: ID) {
    assert!(self.group_id == group_id, ENotAnAdmin);
}

// Getters

/// Get the associated group_id for this AdminCap
public(package) fun group_id(self: &AdminCap): ID {
    self.group_id
}
