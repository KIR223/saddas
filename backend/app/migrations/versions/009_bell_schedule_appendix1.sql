-- Bell schedule per updated Appendix 1 (60-minute pairs). Date-specific exceptions stay unchanged.
BEGIN IMMEDIATE;
DELETE FROM bell_regular;
INSERT INTO bell_regular(pair,start_time,end_time) VALUES
(1,'08:30','09:30'),
(2,'09:35','10:35'),
(3,'10:40','11:40'),
(4,'12:10','13:10'),
(5,'13:15','14:15');
DELETE FROM bell_profiles WHERE kind IN ('monThu','thursday');
INSERT INTO bell_profiles(kind,pair,start_time,end_time) VALUES
('monThu',1,'08:45','09:45'),
('monThu',2,'09:50','10:50'),
('monThu',3,'10:55','11:55'),
('monThu',4,'12:25','13:25'),
('monThu',5,'13:30','14:30'),
('thursday',1,'09:15','10:15'),
('thursday',2,'10:20','11:20'),
('thursday',3,'11:25','12:25'),
('thursday',4,'12:55','13:55'),
('thursday',5,'14:00','15:00');
INSERT INTO curator_slots(day,enabled,start_time,end_time,title) VALUES
(1,1,'08:00','08:40','Разговор о важном'),
(4,1,'08:30','09:10','Россия — мои горизонты')
ON CONFLICT(day) DO UPDATE SET enabled=excluded.enabled,start_time=excluded.start_time,end_time=excluded.end_time,title=excluded.title;
COMMIT;
