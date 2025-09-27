module groups::owner_cap;

const ENotAnOwner: u64 = 0;

/// Channel Owner Capability
///
/// Used for initializing/building the Channel.
/// Soul Bound - Can be transferred via custom transfer function.
public struct OwnerCap has key {
    id: UID,
    group_id: ID,
}

/// Mint a new OwnerCap
/// This is meant to be called only when creating a new Channel.
public(package) fun mint(group_id: ID, ctx: &mut TxContext): OwnerCap {
    OwnerCap { id: object::new(ctx), group_id }
}

/// Transfer a OwnerCap to the transaction sender.
public fun transfer_to_sender(self: OwnerCap, ctx: &TxContext) {
    transfer::transfer(self, ctx.sender());
}

public fun assert_cap(self: &OwnerCap, group_id: ID) {
    assert!(self.group_id == group_id, ENotAnOwner);
}

// Getters

/// Get the associated group_id for this OwnerCap
public(package) fun group_id(self: &OwnerCap): ID {
    self.group_id
}
