export type EdgeAnnotation = {
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  fields: Array<{
    table: string;
    tableComment: string;
    column: string;
    columnComment: string;
  }>;
};

const rows = [
  ["cust_store_info", "店铺信息", "STORE_URL", "店铺连接"],
  ["pmp_pay_order", "付款订单表", "SAME_NAME_PAYER_MOBILE", "同名付款人手机号"],
  ["pmp_pay_order", "付款订单表", "SAME_NAME_PAYER_NAME", "同名付款人名称"],
  ["pmp_pay_order", "付款订单表", "SAME_NAME_PAYER_CERT_NO", "同名付款人证件号"],
  ["pmp_pay_details", "付款明细表", "COLL_EN_ADDRESS", "收款人英文地址"],
  ["pmp_pay_details", "付款明细表", "IDENTITY_NO", "证件号码"],
  ["pmp_pay_details", "付款明细表", "EMAIL", "邮箱"],
  ["pmp_pay_details", "付款明细表", "BENEFICIARY_IDENTIFICATION_NO", "受益人证件号码"],
  ["pmp_pay_details", "付款明细表", "BENEFICIARY_EMAIL", "受益人邮箱"],
  ["pmp_pay_details", "付款明细表", "MOBILE_NO", "手机号码"],
  ["pmp_pay_details", "付款明细表", "COLL_ADDRESS", "收款人地址"],
  ["cust_person_realname_info", "个人实名认证信息", "RESIDENCE_ADDRESS", "居住地详细地址"],
  ["cust_person_realname_info", "个人实名认证信息", "CERT_NO", "证件号"],
  ["cust_person_realname_info", "个人实名认证信息", "CERT_ADDRESS", "证件详细地址"],
  ["cust_person_realname_info", "个人实名认证信息", "EN_NAME", "英文名称"],
  ["cust_customer_info", "客户基础信息", "CUST_MOBILE", "手机号"],
  ["cust_customer_info", "客户基础信息", "EMAIL", "电子邮箱"],
  ["cust_customer_info", "客户基础信息", "EN_NAME", "英文名称"],
  ["cust_customer_info", "客户基础信息", "NAME", "客户名称"],
  ["cust_customer_info", "客户基础信息", "CONTACT_MOBILE", "联系手机号"],
  ["cust_foreign_trade_order", "客户外贸订单表", "BUYER_NAME", "买方名称"],
  ["cust_foreign_trade_order", "客户外贸订单表", "SELLER_NAME", "卖方名称"],
  ["cust_bank_acct_info", "客户银行账号信息", "ENTITY_ADDRESS", "主体详细地址"],
  ["cust_bank_acct_info", "客户银行账号信息", "REF_COMPANY_CERT_NO", "关联企业证件号"],
  ["cust_bank_acct_info", "客户银行账号信息", "ACCT_NAME", "户名"],
  ["cust_bank_acct_info", "客户银行账号信息", "ENTITY_ADDRESS", "详细地址"],
  ["cust_bank_acct_info", "客户银行账号信息", "ID_CARD_NO", "身份证号"],
  ["cust_bank_acct_info", "客户银行账号信息", "ENTITY_IDENTIFICATION_NO", "主体证件号码"],
  ["cust_bank_acct_info", "客户银行账号信息", "ENTITY_EN_ADDRESS", "主体详细英文地址"],
  ["cust_bank_acct_info", "客户银行账号信息", "ENTITY_EMAIL", "主体邮箱"],
  ["cust_bank_acct_info", "客户银行账号信息", "PHONE_NO", "电话号码"],
  ["cust_bank_acct_info", "客户银行账号信息", "ACCT_EN_NAME", "英文户名"],
  ["cust_bank_acct_info", "客户银行账号信息", "RESERVED_MOBILE", "预留手机号"],
  ["cust_enterprise_realname_info", "企业实名认证信息", "RESIDENCE_ADDRESS", "居住地详细地址"],
  ["cust_enterprise_realname_info", "企业实名认证信息", "LEGAL_PERSON_NAME", "法人名称"],
  ["cust_enterprise_realname_info", "企业实名认证信息", "COMPANY_WEBSITE_URL", "线上店铺网址"],
  ["cust_enterprise_realname_info", "企业实名认证信息", "CERT_NO", "证书编号"],
  ["cust_enterprise_realname_info", "企业实名认证信息", "CERT_ADDRESS", "证件所在详细地址"],
  ["cust_enterprise_realname_info", "企业实名认证信息", "NAME", "客户名称"],
  ["cust_enterprise_realname_info", "企业实名认证信息", "EN_NAME", "企业英文名称"],
  ["pmp_coll_order", "收款订单表", "PAYEE_ADDRESS", "收款方地址"],
  ["cust_collections_acct", "收款账号表", "ACCT_NAME", "户名"],
  ["cust_foreign_trade_order_logistics", "外贸订单物流信息表", "GOODS_STORE_URL", "商品店铺链接"],
  ["cust_user_login_log", "用户登录日志", "LOGIN_IP", "LOGIN_IP"],
] as const;

function fields(columns: string[]) {
  const wanted = new Set(columns);
  return rows
    .filter(([, , column]) => wanted.has(column))
    .map(([table, tableComment, column, columnComment]) => ({
      table,
      tableComment,
      column,
      columnComment,
    }));
}

export const edgeAnnotations: Record<string, EdgeAnnotation> = {
  SAME_PHONE: {
    title: "Shared phone",
    titleZh: "共用手机号",
    description: "Customers share a phone or reserved mobile field from customer, payment, order, or bank-account records.",
    descriptionZh: "客户在基础信息、付款、订单或银行账户记录中共用手机号或预留手机号。",
    fields: fields(["CUST_MOBILE", "CONTACT_MOBILE", "MOBILE_NO", "SAME_NAME_PAYER_MOBILE", "PHONE_NO", "RESERVED_MOBILE"]),
  },
  SAME_EMAIL: {
    title: "Shared email",
    titleZh: "共用邮箱",
    description: "Customers share an email-like field from customer, payment, beneficiary, or entity-bank records.",
    descriptionZh: "客户在客户信息、付款明细、受益人或银行主体记录中共用邮箱字段。",
    fields: fields(["EMAIL", "BENEFICIARY_EMAIL", "ENTITY_EMAIL"]),
  },
  SAME_ENTITY_NAME: {
    title: "Shared entity name",
    titleZh: "共用主体名称",
    description: "Customers share a company, account, buyer, seller, legal-person, or enterprise name field.",
    descriptionZh: "客户共用公司名称、户名、买方/卖方名称、法人名称或企业名称字段。",
    fields: fields(["NAME", "EN_NAME", "ACCT_NAME", "ACCT_EN_NAME", "BUYER_NAME", "SELLER_NAME", "LEGAL_PERSON_NAME", "SAME_NAME_PAYER_NAME"]),
  },
  SAME_PERSON_NAME: {
    title: "Shared person name",
    titleZh: "共用个人姓名",
    description: "Customers share a personal name or English name field. This link is weak because names are not unique.",
    descriptionZh: "客户共用个人姓名或英文名。姓名不唯一，因此该关联为弱关联。",
    fields: fields(["NAME", "EN_NAME", "SAME_NAME_PAYER_NAME"]),
  },
  SAME_ADDRESS: {
    title: "Shared address",
    titleZh: "共用地址",
    description: "Customers share residence, certificate, entity, payee, or beneficiary address fields.",
    descriptionZh: "客户共用居住地址、证件地址、主体地址、收款方地址或受益人地址字段。",
    fields: fields(["RESIDENCE_ADDRESS", "CERT_ADDRESS", "ENTITY_ADDRESS", "ENTITY_EN_ADDRESS", "PAYEE_ADDRESS", "COLL_ADDRESS", "COLL_EN_ADDRESS"]),
  },
  SAME_ID_NO: {
    title: "Shared identity number",
    titleZh: "共用证件号码",
    description: "Customers share certificate, identity, beneficiary identity, or related-company certificate fields.",
    descriptionZh: "客户共用证件号、身份号码、受益人证件号或关联企业证件号字段。",
    fields: fields(["CERT_NO", "ID_CARD_NO", "IDENTITY_NO", "BENEFICIARY_IDENTIFICATION_NO", "ENTITY_IDENTIFICATION_NO", "REF_COMPANY_CERT_NO", "SAME_NAME_PAYER_CERT_NO"]),
  },
  SAME_STORE_URL: {
    title: "Shared store URL",
    titleZh: "共用店铺链接",
    description: "Customers share store, goods-store, or company-website URL fields.",
    descriptionZh: "客户共用店铺链接、商品店铺链接或企业网站字段。",
    fields: fields(["STORE_URL", "GOODS_STORE_URL", "COMPANY_WEBSITE_URL"]),
  },
  SAME_IP: {
    title: "Shared login IP",
    titleZh: "共用登录 IP",
    description: "Customers share login IP evidence from user login logs. This link is weak because IPs can be shared by offices, VPNs, or carriers.",
    descriptionZh: "客户在登录日志中共用登录 IP。办公室、VPN 或运营商网络可能共享 IP，因此该关联为弱关联。",
    fields: fields(["LOGIN_IP"]),
  },
};

export const sameAttributeTypeAliases: Record<string, string> = {
  same_mobile_phone: "SAME_PHONE",
  same_email: "SAME_EMAIL",
  same_business_name: "SAME_ENTITY_NAME",
  same_person_name: "SAME_PERSON_NAME",
  same_id_no: "SAME_ID_NO",
  same_address: "SAME_ADDRESS",
  same_store_url: "SAME_STORE_URL",
  same_ip: "SAME_IP",
};

export const sameAttributeTypeLabels: Record<string, string> = {
  same_mobile_phone: "Same Mobile Phone",
  same_email: "Same Email",
  same_business_name: "Same Business Name",
  same_person_name: "Same Person Name",
  same_id_no: "Same Identity Number",
  same_address: "Same Address",
  same_store_url: "Same Store URL",
  same_ip: "Same IP",
};

export const sameAttributeTypeLabelsZh: Record<string, string> = {
  same_mobile_phone: "同卡/同手机号",
  same_email: "同邮箱",
  same_business_name: "同企业名称",
  same_person_name: "同姓名",
  same_id_no: "同证件号",
  same_address: "同地址",
  same_store_url: "同店铺链接",
  same_ip: "同登录 IP",
};

export function getEdgeAnnotation(params: {
  edgeType?: string;
  sameAttributeType?: string;
}) {
  if (params.sameAttributeType && edgeAnnotations[params.sameAttributeType]) {
    return edgeAnnotations[params.sameAttributeType];
  }

  if (params.edgeType && edgeAnnotations[params.edgeType]) {
    return edgeAnnotations[params.edgeType];
  }

  return params.sameAttributeType
    ? edgeAnnotations[sameAttributeTypeAliases[params.sameAttributeType] ?? ""]
    : undefined;
}
