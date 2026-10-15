BEGIN;
CREATE TABLE accounting_connections (
 organization_id text NOT NULL REFERENCES organizations(id), id uuid NOT NULL, config jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'disconnected' CHECK(status='disconnected'), read_only boolean NOT NULL DEFAULT true CHECK(read_only), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,id)
);
CREATE TABLE accounting_mappings (
 organization_id text NOT NULL, connection_id uuid NOT NULL, dimension_key text NOT NULL, unit_id text, building text NOT NULL, reviewed_by text NOT NULL, PRIMARY KEY(organization_id,connection_id,dimension_key), FOREIGN KEY(organization_id,connection_id) REFERENCES accounting_connections(organization_id,id)
);
CREATE TABLE accounting_imports (
 id uuid PRIMARY KEY, organization_id text NOT NULL, connection_id uuid NOT NULL, connection_revision integer NOT NULL, actor_uid text NOT NULL, file_name text NOT NULL, file_hash text NOT NULL, packet jsonb NOT NULL, status text NOT NULL CHECK(status IN('preview','committed')), created_at timestamptz NOT NULL DEFAULT now(), committed_at timestamptz, FOREIGN KEY(organization_id,connection_id) REFERENCES accounting_connections(organization_id,id)
);
CREATE TABLE accounting_documents (
 organization_id text NOT NULL, connection_id uuid NOT NULL, external_id text NOT NULL, source_updated_at timestamptz NOT NULL, source_hash text NOT NULL, document_type text NOT NULL, number text NOT NULL, posting_date date NOT NULL, currency text NOT NULL CHECK(currency='AED'), status text NOT NULL CHECK(status IN('draft','posted','cancelled')), partner_name text NOT NULL, total numeric(18,2) NOT NULL CHECK(total>=0), outstanding numeric(18,2) NOT NULL CHECK(outstanding>=0 AND outstanding<=total), last_import uuid NOT NULL REFERENCES accounting_imports(id), PRIMARY KEY(organization_id,connection_id,external_id), FOREIGN KEY(organization_id,connection_id) REFERENCES accounting_connections(organization_id,id)
);
CREATE TABLE accounting_lines (
 organization_id text NOT NULL, connection_id uuid NOT NULL, external_id text NOT NULL, document_id text NOT NULL, account_code text NOT NULL, account_class text NOT NULL CHECK(account_class IN('revenue','expense','balance')), dimension_key text NOT NULL, debit numeric(18,2) NOT NULL CHECK(debit>=0), credit numeric(18,2) NOT NULL CHECK(credit>=0), description text NOT NULL, CHECK(debit=0 OR credit=0), PRIMARY KEY(organization_id,connection_id,external_id), FOREIGN KEY(organization_id,connection_id,document_id) REFERENCES accounting_documents(organization_id,connection_id,external_id)
);
CREATE TABLE accounting_document_history (
 id bigserial PRIMARY KEY, organization_id text NOT NULL, connection_id uuid NOT NULL, external_id text NOT NULL, source_hash text NOT NULL, snapshot jsonb NOT NULL, import_id uuid NOT NULL REFERENCES accounting_imports(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE accounting_sync_logs (
 id uuid PRIMARY KEY, organization_id text NOT NULL, connection_id uuid NOT NULL, actor_uid text NOT NULL, operation text NOT NULL, status text NOT NULL, message text NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(organization_id,connection_id) REFERENCES accounting_connections(organization_id,id)
);
CREATE INDEX accounting_docs_period ON accounting_documents(organization_id,connection_id,posting_date);
CREATE INDEX accounting_sync_scope ON accounting_sync_logs(organization_id,connection_id,created_at DESC);
COMMIT;
