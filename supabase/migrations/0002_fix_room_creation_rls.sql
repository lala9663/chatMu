-- 방 생성 흐름 RLS 수정
-- 문제 1: rooms_read가 "멤버만"이라 방 생성 직후 RETURNING(select)이 거부됨
--         → 생성자도 읽을 수 있어야 함
-- 문제 2: room_members에 insert 정책이 없어 방 생성자가 본인을 멤버로 등록 못 함
--         (코드 입장은 join-room Edge Function이 서비스 롤로 처리하므로 별개)

drop policy rooms_read on public.rooms;
create policy rooms_read on public.rooms
  for select using (created_by = auth.uid() or public.is_room_member(id));

create policy room_members_insert_creator on public.room_members
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.rooms r
      where r.id = room_id and r.created_by = auth.uid()
    )
  );
