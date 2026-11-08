-- Preserve existing IDs and financial records; repair the single parent hierarchy.
DO $$
DECLARE group_id TEXT;
BEGIN
 SELECT "id" INTO group_id FROM "Organization" WHERE "code" = 'BEMS-GROUP';
 IF group_id IS NOT NULL THEN
  IF EXISTS (SELECT 1 FROM "Organization" WHERE "type" = 'GROUP' AND "id" <> group_id) THEN
   RAISE EXCEPTION 'Multiple parent groups require explicit review before hierarchy repair';
  END IF;
  UPDATE "Organization" SET "type"='GROUP', "legalName"='BEMS Group', "parentGroupId"=NULL WHERE "id"=group_id;
  UPDATE "Organization" SET "parentGroupId"=group_id WHERE "id"<>group_id AND "parentGroupId" IS NULL;
 END IF;
 UPDATE "Employee" SET "workLocation"='BEMS_GROUP' WHERE "workLocation" IN ('BEMS_GROUP_HQ','BEMS Group HQ','General HQ','HQ');
END $$;
