"""
banks.py — Thai financial institution reference data.

THAI_BANKS   list of dicts with code / name / name_en
BANK_BY_CODE dict keyed by code for fast lookup
BANK_CODE_FIELDS set of field names that should render as a bank selector
"""

from typing import Dict, List

THAI_BANKS: List[Dict[str, str]] = [
    {"code": "BBL",       "name": "ธนาคารกรุงเทพ",                              "name_en": "Bangkok Bank"},
    {"code": "KBANK",     "name": "ธนาคารกสิกรไทย",                             "name_en": "Kasikorn Bank"},
    {"code": "KTB",       "name": "ธนาคารกรุงไทย",                              "name_en": "Krungthai Bank"},
    {"code": "TTB",       "name": "ธนาคารทหารไทยธนชาต",                         "name_en": "TMBThanachart Bank"},
    {"code": "SCB",       "name": "ธนาคารไทยพาณิชย์",                           "name_en": "Siam Commercial Bank"},
    {"code": "BAY",       "name": "ธนาคารกรุงศรีอยุธยา",                        "name_en": "Krungsri"},
    {"code": "KKP",       "name": "ธนาคารเกียรตินาคินภัทร",                     "name_en": "KKP Bank"},
    {"code": "CIMBT",     "name": "ธนาคารซีไอเอ็มบีไทย",                       "name_en": "CIMB Thai"},
    {"code": "TISCO",     "name": "ธนาคารทิสโก้",                               "name_en": "TISCO Bank"},
    {"code": "UOBT",      "name": "ธนาคารยูโอบี",                               "name_en": "UOB Thai"},
    {"code": "LHFG",      "name": "ธนาคารแลนด์ แอนด์ เฮ้าส์",                 "name_en": "Land and Houses Bank"},
    {"code": "ICBCT",     "name": "ธนาคารไอซีบีซี (ไทย)",                     "name_en": "ICBC Thai"},
    {"code": "GSB",       "name": "ธนาคารออมสิน",                               "name_en": "Government Savings Bank"},
    {"code": "GHB",       "name": "ธนาคารอาคารสงเคราะห์",                      "name_en": "GH Bank"},
    {"code": "BAAC",      "name": "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร",     "name_en": "BAAC"},
    {"code": "ISBT",      "name": "ธนาคารอิสลามแห่งประเทศไทย",                 "name_en": "Islamic Bank of Thailand"},
    {"code": "PROMPTPAY", "name": "พร้อมเพย์",                                  "name_en": "PromptPay"},
    {"code": "TRUEMONEY", "name": "ทรูมันนี่ วอลเล็ต",                         "name_en": "TrueMoney Wallet"},
]

BANK_BY_CODE: Dict[str, Dict[str, str]] = {b["code"]: b for b in THAI_BANKS}

# Field names (exact) that should render as a bank selector in the UI.
# The selector auto-fills รหัสธนาคาร with the bank code.
BANK_CODE_FIELDS = {"รหัสธนาคาร", "BANK_ID"}
