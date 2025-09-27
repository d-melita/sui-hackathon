module groups::member;

public struct Member has key, store {
    id: UID,
    user_address: address,
    group_id: ID,
    reputation: u8,
}

public fun new_member(
    ctx: &mut TxContext,
    user_address: address,
    group_id: ID,
): Member {
    Member {
        id: object::new(ctx),
        user_address,
        group_id,
        reputation: 0,
    }
}

public fun increase_reputation(member: &mut Member) {
    member.reputation = member.reputation + 1;
}

public fun decrease_reputation(member: &mut Member) {
    member.reputation = member.reputation - 1;
}

public fun delete_member(member: Member) {
    let Member { id, .. } = member;
    object::delete(id);
}

// Getters
public fun get_id(member: &Member): ID {
    object::id(member)
}

public fun get_user_address(member: &Member): address {
    member.user_address
}

public fun get_group_id(member: &Member): ID {
    member.group_id
}

public fun get_reputation(member: &Member): u8 {
    member.reputation
}