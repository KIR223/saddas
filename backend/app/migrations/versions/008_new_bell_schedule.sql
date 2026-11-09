-- New bell schedule from Appendix 1. Keep date-specific exceptions unchanged.
BEGIN IMMEDIATE;
DELETE FROM bell_regular;
INSERT INTO bell_regular(pair,start_time,end_time) VALUES
(1,'08:30','09:00'),
(2,'09:05','09:35'),
(3,'09:40','10:10'),
(4,'10:15','10:45'),
(5,'10:50','11:20');
DELETE FROM bell_profiles WHERE kind IN ('monThu','thursday');
INSERT INTO bell_profiles(kind,pair,start_time,end_time) VALUES
('monThu',1,'08:35','09:05'),
('monThu',2,'09:10','09:40'),
('monThu',3,'09:45','10:15'),
('monThu',4,'10:20','10:50'),
('monThu',5,'10:55','11:25');
INSERT INTO bell_profiles(kind,pair,start_time,end_time) VALUES
('thursday',1,'09:05','09:35'),
('thursday',2,'09:40','10:10'),
('thursday',3,'10:15','10:45'),
('thursday',4,'10:50','11:20'),
('thursday',5,'11:25','11:55');
INSERT INTO curator_slots(day,enabled,start_time,end_time,title) VALUES
(1,1,'08:00','08:30','Разговор о важном'),
(4,1,'08:30','09:00','Россия — мои горизонты')
ON CONFLICT(day) DO UPDATE SET enabled=excluded.enabled,start_time=excluded.start_time,end_time=excluded.end_time,title=excluded.title;
COMMIT;
