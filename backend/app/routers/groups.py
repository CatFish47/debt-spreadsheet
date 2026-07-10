from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.group import Group, GroupMember
from app.models.user import User
from app.schemas.group import GroupCreate, GroupDetailOut, GroupOut, JoinGroupIn, MemberOut, UserOut

router = APIRouter()


def _assert_member(db: Session, group_id: UUID, user_id: UUID) -> GroupMember:
    member = (db.query(GroupMember)
              .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
              .first())
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    return member


@router.get("", response_model=list[GroupOut])
def list_groups(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = (db.query(GroupMember)
                   .filter(GroupMember.user_id == current_user.id)
                   .all())
    result = []
    for m in memberships:
        group = m.group
        member_count = db.query(GroupMember).filter(GroupMember.group_id == group.id).count()
        out = GroupOut.model_validate(group)
        out.member_count = member_count
        result.append(out)
    return result


@router.post("", response_model=GroupDetailOut, status_code=201)
def create_group(body: GroupCreate, current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    group = Group(name=body.name, currency=body.currency, created_by=current_user.id)
    db.add(group)
    db.flush()
    member = GroupMember(group_id=group.id, user_id=current_user.id)
    db.add(member)
    db.commit()
    db.refresh(group)
    return _group_detail(db, group)


@router.get("/{group_id}", response_model=GroupDetailOut)
def get_group(group_id: UUID, current_user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    _assert_member(db, group_id, current_user.id)
    return _group_detail(db, group)


@router.post("/{group_id}/join", response_model=GroupDetailOut)
def join_group(group_id: UUID, body: JoinGroupIn,
               current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.join_code.upper() != body.code.upper():
        raise HTTPException(status_code=403, detail="Invalid join code")

    existing = (db.query(GroupMember)
                .filter(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id)
                .first())
    if not existing:
        db.add(GroupMember(group_id=group_id, user_id=current_user.id))
        db.commit()
        db.refresh(group)

    return _group_detail(db, group)


@router.post("/join/{code}", response_model=GroupDetailOut)
def join_by_code(code: str, current_user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    group = db.query(Group).filter(Group.join_code == code.upper()).first()
    if not group:
        raise HTTPException(status_code=404, detail="Invalid join code")

    existing = (db.query(GroupMember)
                .filter(GroupMember.group_id == group.id, GroupMember.user_id == current_user.id)
                .first())
    if not existing:
        db.add(GroupMember(group_id=group.id, user_id=current_user.id))
        db.commit()
        db.refresh(group)

    return _group_detail(db, group)


@router.delete("/{group_id}/members/me", status_code=204)
def leave_group(group_id: UUID, current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    member = _assert_member(db, group_id, current_user.id)
    db.delete(member)
    db.commit()


def _group_detail(db: Session, group: Group) -> GroupDetailOut:
    members_out = [
        MemberOut(
            id=m.id,
            user=UserOut(id=m.user.id, name=m.user.name),
            joined_at=m.joined_at,
        )
        for m in group.members
    ]
    return GroupDetailOut(
        id=group.id,
        name=group.name,
        join_code=group.join_code,
        currency=group.currency,
        created_by=group.created_by,
        created_at=group.created_at,
        member_count=len(members_out),
        members=members_out,
    )
