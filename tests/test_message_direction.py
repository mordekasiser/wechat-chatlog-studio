from chatlog_studio.core import (
    ContactRecord,
    build_message_records,
    is_outgoing_message,
)


def test_is_outgoing_message_prefers_real_sender_mapping() -> None:
    assert is_outgoing_message("wxid_self", "wxid_self", status=3) is True
    assert is_outgoing_message("wxid_peer", "wxid_self", status=2) is False


def test_is_outgoing_message_falls_back_to_status_when_mapping_missing() -> None:
    assert is_outgoing_message(None, "wxid_self", status=2) is True
    assert is_outgoing_message(None, "wxid_self", status=3) is False


def test_build_message_records_uses_sender_mapping_for_direction() -> None:
    contact = ContactRecord(
        username="wxid_peer",
        display_name="戈涵潇",
        remark="",
        nick_name="戈涵潇",
        alias="",
    )
    rows = [
        (336, 1, 1776689079, 3, 661, "可能陪玩，带妹啥的", "", None),
        (338, 1, 1776689108, 3, 5, "遇到就一秒睡觉了zz", "", None),
        (380, 1, 1776821512, 2, 5, "zzz，好困啊", "", None),
    ]
    sender_name_map = {
        5: "wxid_self",
        661: "wxid_peer",
    }

    messages = build_message_records(
        rows,
        contact,
        account_username="wxid_self",
        sender_name_map=sender_name_map,
    )

    assert [message.is_outgoing for message in messages] == [False, True, True]
    assert [message.sender for message in messages] == ["戈涵潇", "Me", "Me"]
