export const DEFAULT_SUBSIDIARY_LOGOS: Record<string, string> = {
  'BEMS-GROUP': '/bems-group-logo.png?v=20261024',
  BBH: '/logos/bbh.svg',
  BTECH: '/logos/smartairs.svg',
  BSA: '/logos/studio-arella.svg',
  BEDU: '/logos/bedu.svg',
  BAGRO: '/logos/bems-farms.svg',
};

export interface SubsidiaryBranding {
  subsidiaryId: string;
  subsidiaryName: string;
  subsidiaryCode: string;
  subsidiaryType: string;
  subsidiaryBrandColor: string;
  subsidiaryLogoUrl: string | null;
}

type OrgLike = {
  id?: string | null;
  legalName?: string | null;
  code?: string | null;
  type?: string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
  settings?: Array<{ key: string; value: string }>;
} | null | undefined;

export function resolveOrganizationBranding(org: OrgLike): SubsidiaryBranding {
  if (!org) {
    return {
      subsidiaryId: '',
      subsidiaryName: 'Staff Workspace',
      subsidiaryCode: '',
      subsidiaryType: 'SUBSIDIARY',
      subsidiaryBrandColor: '#ea580c',
      subsidiaryLogoUrl: null,
    };
  }

  const code = String(org.code || '').trim();
  const type = String(org.type || 'SUBSIDIARY').trim();
  const brandColorSetting = org.settings?.find((s) => s.key === 'BRAND_COLOR')?.value;
  const logoUrlSetting = org.settings?.find((s) => s.key === 'BRAND_LOGO_URL')?.value;

  const resolvedColor =
    (org.brandColor && org.brandColor.trim()) ||
    (brandColorSetting && brandColorSetting.trim()) ||
    (type === 'GROUP' ? '#ea580c' : '#0d8a70');

  const resolvedLogo =
    (org.logoUrl && org.logoUrl.trim()) ||
    (logoUrlSetting && logoUrlSetting.trim()) ||
    DEFAULT_SUBSIDIARY_LOGOS[code] ||
    (type === 'GROUP' ? '/bems-group-logo.png?v=20261024' : null);

  return {
    subsidiaryId: org.id || '',
    subsidiaryName: (org.legalName && org.legalName.trim()) || code || 'Staff Workspace',
    subsidiaryCode: code,
    subsidiaryType: type,
    subsidiaryBrandColor: resolvedColor,
    subsidiaryLogoUrl: resolvedLogo,
  };
}

