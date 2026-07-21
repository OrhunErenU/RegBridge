// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RegBridgeSBT — ERC-5192 Soulbound KYC Sertifikası
 * @notice Devredilemez (soulbound) KYC sertifikası. Token İÇİNDE hiçbir kişisel
 *         veri tutulmaz; yalnızca ZK-KYC "commitment" hash'i saklanır.
 *         Kişisel veriler (TC kimlik no, ad-soyad, vb.) borsanın kendi
 *         veritabanında kalır — bu sayede KVKK uyumu doğrudan sağlanır.
 *
 *  - ERC-5192: locked() her zaman true → cüzdanlar transferi engeller.
 *  - Issuer (yetkili borsa/KVHS) mint eder.
 *  - MASAK rolü (regulator) sertifikayı revoke (kara liste) edebilir.
 *  - 12 aylık geçerlilik; süre dolunca isValid() false döner.
 */
contract RegBridgeSBT {
    // ---- ERC-5192 ----
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    // ---- ERC-721 (asgari) ----
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    // ---- RegBridge'e özgü ----
    event Minted(uint256 indexed tokenId, address indexed owner, bytes32 commitment, address issuer);
    event Revoked(uint256 indexed tokenId, string reason);

    struct Certificate {
        address owner;
        bytes32 commitment;   // H(kişisel veri || salt) — kişisel verinin kendisi DEĞİL
        address issuer;       // mint eden yetkili borsa
        uint64  issuedAt;
        uint64  expiresAt;
        bool    revoked;
        bool    over18;       // ifşa edilen minimal önerme
    }

    string public name = "RegBridge KYC Certificate";
    string public symbol = "RB-KYC";

    address public admin;                         // protokol yöneticisi
    mapping(address => bool) public isIssuer;     // yetkili borsalar (KVHS)
    mapping(address => bool) public isRegulator;  // MASAK/SPK

    uint256 public totalSupply;
    mapping(uint256 => Certificate) public certificates;   // tokenId -> sertifika
    mapping(address => uint256) public tokenOfOwner;       // owner -> tokenId (0 = yok)

    uint64 public constant VALIDITY = 365 days;

    modifier onlyAdmin() { require(msg.sender == admin, "yalnizca admin"); _; }
    modifier onlyIssuer() { require(isIssuer[msg.sender], "yalnizca yetkili borsa"); _; }
    modifier onlyRegulator() { require(isRegulator[msg.sender], "yalnizca regulator"); _; }

    constructor() {
        admin = msg.sender;
        isIssuer[msg.sender] = true;     // dağıtan, başlangıçta issuer
        isRegulator[msg.sender] = true;
    }

    function setIssuer(address a, bool v) external onlyAdmin { isIssuer[a] = v; }
    function setRegulator(address a, bool v) external onlyAdmin { isRegulator[a] = v; }

    /// @notice KYC onayı sonrası yetkili borsa, kullanıcı için SBT mint eder.
    function mint(address to, bytes32 commitment, bool over18) external onlyIssuer returns (uint256 tokenId) {
        require(to != address(0), "sifir adres");
        require(tokenOfOwner[to] == 0, "cuzdanda zaten SBT var");

        tokenId = ++totalSupply;
        certificates[tokenId] = Certificate({
            owner: to,
            commitment: commitment,
            issuer: msg.sender,
            issuedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp) + VALIDITY,
            revoked: false,
            over18: over18
        });
        tokenOfOwner[to] = tokenId;

        emit Transfer(address(0), to, tokenId);   // mint
        emit Locked(tokenId);                      // ERC-5192: kalıcı kilit
        emit Minted(tokenId, to, commitment, msg.sender);
    }

    /// @notice ERC-5192 — token her zaman kilitli (devredilemez).
    function locked(uint256 tokenId) external view returns (bool) {
        require(certificates[tokenId].owner != address(0), "token yok");
        return true;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = certificates[tokenId].owner;
        require(o != address(0), "token yok");
        return o;
    }

    function balanceOf(address o) external view returns (uint256) {
        return tokenOfOwner[o] == 0 ? 0 : 1;
    }

    /// @notice Başka bir borsa, belge istemeden geçerliliği kontrol eder.
    function isValid(address ownerWallet) external view returns (bool) {
        uint256 id = tokenOfOwner[ownerWallet];
        if (id == 0) return false;
        Certificate storage c = certificates[id];
        if (c.revoked) return false;
        if (block.timestamp > c.expiresAt) return false;
        return true;
    }

    /// @notice MASAK kara liste: sertifika iptal → tüm borsalarda anında geçersiz.
    function revoke(address ownerWallet, string calldata reason) external onlyRegulator {
        uint256 id = tokenOfOwner[ownerWallet];
        require(id != 0, "SBT yok");
        certificates[id].revoked = true;
        emit Revoked(id, reason);
    }

    /// @notice Soulbound: transfer KESİNLİKLE engellenir.
    function transferFrom(address, address, uint256) external pure {
        revert("ERC-5192: soulbound token devredilemez");
    }
    function safeTransferFrom(address, address, uint256) external pure {
        revert("ERC-5192: soulbound token devredilemez");
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        // ERC-165, ERC-721, ERC-5192 (0xb45a3c0e)
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0xb45a3c0e;
    }
}
